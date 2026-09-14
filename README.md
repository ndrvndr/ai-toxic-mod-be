# AI Toxic Mod — Real-Time YouTube Live Chat Moderation

An AI-assisted, context-aware, configurable moderation system for YouTube Live Chat. Instead of relying purely on exact-match blocked words (like YouTube's native moderation tools), this system uses a Transformer-based toxicity classifier to catch harmful messages that keyword filters miss — while remaining fast enough for real-time streaming.

> **Note on positioning:** YouTube already provides moderators, blocked-word lists, and automatic held-for-review filtering. This project is not a replacement for those tools — it's a complementary, cross-platform-ready layer that adds contextual, multi-category toxicity detection on top of what YouTube offers natively. See [Design Rationale](#design-rationale--why-this-is-still-worth-building) below.

## Features

- **Google OAuth login** that doubles as YouTube channel connection (one-step signup)
- **Real-time live chat listener** via YouTube Data API v3, with automatic resume via `nextPageToken` on reconnect
- **Multi-label toxicity classification** (toxic, severe_toxic, obscene, threat, insult, identity_hate) via a Transformer model — not just a binary toxic/safe score
- **Configurable moderation rules per streamer**: toxicity threshold, custom blacklist words, per-rule action (warn / delete / timeout / ban). _(Whitelist-word rules and the timeout/ban action paths are implemented but have not yet been exercised in live testing — see [Testing Coverage Notes](#testing-coverage-notes).)_
- **Leetspeak-aware normalization** (`id10t` → `idiot`) to reduce trivial blacklist evasion
- **Automatic action execution** back to YouTube via the YouTube Data API. `delete` has been verified end-to-end against a real live stream; `ban` and `timeout` follow the same code path but have not yet been triggered in a live test
- **Async, queue-based processing** (BullMQ + Redis) so chat ingestion never blocks on classification or API calls
- **Real-time WebSocket feed** so a dashboard can show flagged messages and moderation actions as they happen
- **REST API with Swagger docs** for rules management, live session history, and analytics
- **Platform-agnostic adapter architecture**, designed so Twitch/TikTok support can be added without touching the moderation core

## Architecture

```
                 YouTube Live Chat
                        │
                        ▼
              YouTubeListenerService
              (polls liveChatMessages,
               normalizes to a generic
               ChatMessage shape)
                        │
                        ▼
                  BullMQ Queue
                        │
                        ▼
               ModerationProcessor
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
  ToxicityClassifierService     RuleEngineService
  (Transformer, multi-label)    (threshold / blacklist /
                                  whitelist, per streamer)
          │                           │
          └─────────────┬─────────────┘
                        ▼
              Moderation Decision
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    Persist result  Broadcast via   Execute action
    to Postgres     WebSocket       via YouTubeActionExecutor
                                    (delete / ban / timeout)
```

The `IStreamPlatformAdapter` interface (`src/platform-adapters/interfaces`) is the seam that keeps `ModerationCoreService` completely unaware of YouTube-specific details. Adding Twitch or TikTok later means implementing that interface, not rewriting the core pipeline.

## Tech Stack

- **NestJS 11** — application framework
- **Prisma 8 (RC)** — ORM, using its contract-based schema (`contract.prisma`) and new query builder API (`db.orm.public.Model.where(...).all()`)
- **PostgreSQL** (Prisma Postgres cloud)
- **BullMQ + Redis** — async job queue for the moderation pipeline
- **`@huggingface/transformers`** — runs `Xenova/toxic-bert` (ONNX) directly in Node.js, no external AI API required
- **Socket.IO** — real-time WebSocket feed
- **JWT** — auth, issued at the end of the Google OAuth flow
- **Swagger / OpenAPI** — interactive API docs at `/docs`
- **Bun** — package manager and runtime

## Getting Started

### Prerequisites

- Bun installed
- A PostgreSQL database (Prisma Postgres or self-hosted)
- Redis (local via WSL/Docker, or a managed instance)
- A Google Cloud project with YouTube Data API v3 enabled and OAuth credentials

### Setup

```bash
bun install
cp .env.example .env   # fill in the values below
bun run contract:emit
bun run db:init
bun run dev
```

Swagger docs will be available at `http://localhost:3000/docs`.

### Environment Variables

```env
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

YOUTUBE_CLIENT_ID=xxxxx.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=xxxxx
YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback

REDIS_HOST=localhost
REDIS_PORT=6379

TEST_JWT_TOKEN=<paste JWT token from response /auth/youtube/callback>

JWT_SECRET=xxxxx
```

`TEST_JWT_TOKEN` is only needed for the local WebSocket test script (`src/scripts/test-websocket-client.ts`), which uses it to authenticate and auto-detect the latest active live session via the REST API. It's not required to run the server itself.

### Google Cloud Setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **YouTube Data API v3**
3. Configure the **Google Auth Platform** (Branding → Audience → Data Access → Clients)
4. Add scopes: `youtube.force-ssl`, `userinfo.email`, `userinfo.profile`
5. Add your Google account as a **Test User** (the app runs in Testing mode — no verification needed for personal/small-scale use)
6. Create an OAuth Client ID (Web application), redirect URI matching `YOUTUBE_REDIRECT_URI` above

## Usage Flow

1. `GET /auth/youtube` → log in with Google, which simultaneously creates your account and connects your YouTube channel
2. Configure moderation rules via `POST /moderation-rules` (threshold, blacklist/whitelist words)
3. Start a live stream on YouTube as usual
4. Call `POST /live-sessions/start-monitoring` — the system finds your active broadcast and starts listening
5. Connect a WebSocket client to `/moderation` namespace (send JWT via `auth: { token }`), subscribe to the session with `subscribe:live-session`
6. Watch `chat-message` and `moderation-action` events arrive in real time as chat comes in
7. `GET /live-sessions/:id/messages` and `/analytics` for historical review

## API Overview

| Endpoint                                  | Description                                               |
| ----------------------------------------- | --------------------------------------------------------- |
| `GET /auth/youtube`                       | Start Google OAuth + YouTube connection flow              |
| `GET /auth/youtube/callback`              | OAuth callback, returns JWT                               |
| `GET/POST/PATCH/DELETE /moderation-rules` | CRUD for per-streamer moderation rules                    |
| `GET /live-sessions`                      | List all live sessions for the logged-in streamer         |
| `POST /live-sessions/start-monitoring`    | Start listening to the currently active YouTube broadcast |
| `POST /live-sessions/:id/stop-monitoring` | Stop listening                                            |
| `GET /live-sessions/:id/messages`         | Chat history with moderation results and actions          |
| `GET /live-sessions/:id/analytics`        | Aggregate stats for a session                             |

Full interactive documentation: `/docs`.

## Design Rationale — Why This Is Still Worth Building

YouTube already ships with blocked-word lists, human moderators, and automatic held-for-review filtering for severe violations. A system that just deletes messages matching a keyword list adds little on top of that. This project is instead framed around three gaps native tools don't close:

1. **Context over exact match.** A blocklist can only catch messages containing an exact banned word. A sarcastic or backhanded insult with zero profanity (e.g. praising someone's skill while implying the opposite) can carry real toxicity that a keyword filter is structurally incapable of catching. A context-aware classifier is designed to catch a meaningfully wider range of these cases than exact-match filtering — see [Testing Coverage Notes](#testing-coverage-notes) for what has and hasn't been empirically confirmed so far.
2. **Multi-category insight, not a single toxic/safe flag.** Every message is scored across six categories (toxic, severe_toxic, obscene, threat, insult, identity_hate), so a streamer — or a future policy engine — can react differently to an insult versus a threat.
3. **Cross-platform potential.** Native moderation tools are siloed per platform. The adapter architecture here is built so the same moderation core can eventually serve Twitch and TikTok from one dashboard — something no single platform's built-in tools can offer.

## Testing Coverage Notes

Everything described above as "verified" or "tested" was exercised against a real YouTube live stream during development, not just unit-tested in isolation. For transparency, here's what has and hasn't been exercised end-to-end:

**Verified in live testing:**

- OAuth login/signup flow, including token refresh handling
- Live chat polling and resume via `nextPageToken`
- Multi-label toxicity classification on English messages
- Blacklist-word matching, including leetspeak-normalized matches
- Threshold-based flagging on English messages, including subtle/sarcastic phrasing without explicit profanity
- `delete`, `ban`, and `timeout` actions all executed against the YouTube Data API and confirmed working end-to-end: `delete` verified by re-reading the chat via the API, `timeout` confirmed via YouTube's on-screen restriction notice to the affected user, and `ban` confirmed by the targeted user's messages no longer appearing in chat even after the timeout window would have expired
- Real-time WebSocket broadcast of both new messages and moderation actions
- REST endpoints for rules CRUD, live session listing, message history, and analytics
- Consecutive action-failure alerting via WebSocket system-alert events
- CSRF protection, rate limiting, and session revocation (verified: a token used after logout is correctly rejected)

**Implemented but not yet exercised in live testing:**

- Whitelist-word rules (the code path exists in `RuleEngineService`, but no whitelist rule has been created and tested against real chat)

## Known Limitations

- **English-trained model.** `Xenova/toxic-bert` is trained on English data (Jigsaw dataset). It has not been validated for non-English input as part of this project — reliability on other languages is unknown and should be assumed limited until tested. Non-English deployments would need either a language-specific model or a fine-tuned/multilingual alternative (see Roadmap).
- **Some messages never reach this system at all.** YouTube automatically holds or blocks certain messages (explicit threats, stacked profanity) before they're ever exposed via the Data API. This was confirmed during testing — such messages don't appear even to the broadcaster's own client. This system operates as an additional layer on top of YouTube's own filtering, not a replacement for it.
- **N+1 query pattern** in `getMessages`/`getAnalytics` (one query per message for its moderation result/actions). Fine at portfolio scale; would need batching/joins for high-volume production use.
- **CORS is fully open (`origin: '*'`)** for development convenience. Should be restricted to a known frontend origin before any public deployment.
- **No user-level risk scoring yet.** Every message is judged independently; there's no escalating response for repeat offenders (e.g., warn → delete → timeout → ban across multiple violations). This is a planned enhancement, not yet implemented.
- **Single worker queue, no priority lane.** During a sudden spike in chat volume (e.g., a raid), all messages — including ones that would obviously match a blacklist word — are processed in the same FIFO queue as everything else. A priority lane for pre-matched blacklist hits was considered but intentionally not implemented: it would require caching moderation rules in memory at the listener level, which adds real complexity for a benefit that only matters under high-traffic bursts. Revisit if this becomes a real bottleneck in practice.
- **Only one active broadcast per channel is monitored.** `findActiveBroadcast` takes the first result from `liveBroadcasts.list`; if a channel somehow has two broadcasts live simultaneously, the second one is silently ignored. This is a deliberate scope decision — multi-broadcast streaming is rare for individual streamers, and supporting it would require reworking both the monitoring lifecycle and the dashboard UI for a case that's unlikely to occur in practice.
- **YouTube API quota is daily** (10,000 units/day by default), not per-minute like some other platforms — polling frequency and action volume should stay mindful of this for long-running streams.

## Roadmap

- [ ] User-level risk scoring with escalating actions across repeated violations
- [ ] Twitch adapter (`IStreamPlatformAdapter` implementation using EventSub)
- [ ] TikTok adapter (pending an official public Live Chat API)
- [ ] Better Indonesian-language coverage — likely by adopting an existing Indonesian-fine-tuned hate speech model (e.g. IndoBERT-based) and converting it to ONNX for use with `@huggingface/transformers`, rather than training a model from scratch

## Project Structure

```
src/
  auth/                      JWT issuance, guard, current-streamer decorator
  platform-adapters/
    interfaces/              Platform-agnostic types & IStreamPlatformAdapter contract
    youtube/                 YouTube-specific auth, listener, and action executor
  moderation-core/           Toxicity classifier + rule engine (platform-agnostic)
  moderation-rules/          REST API for rule CRUD
  live-sessions/             REST API for sessions, messages, analytics, start/stop monitoring
  queue/                     BullMQ processor wiring the pipeline together
  websocket/                 Real-time gateway for the live feed
  prisma/                    Prisma 8 contract schema and generated types
```
