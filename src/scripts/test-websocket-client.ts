import { io } from "socket.io-client";

const TOKEN = process.env.TEST_JWT_TOKEN;
const API_BASE_URL = `http://localhost:${process.env.PORT ?? 3000}`;

async function getLatestLiveSessionId(token: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/live-sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch live sessions: ${response.status} ${await response.text()}`,
    );
  }

  const { data } = (await response.json()) as {
    data: Array<{ id: string; status: string; startedAt: string }>;
  };

  const liveSessions = data.filter((s) => s.status === "live");
  if (liveSessions.length === 0) {
    throw new Error(
      "No active live session found. Call POST /live-sessions/start-monitoring first.",
    );
  }

  liveSessions.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  return liveSessions[0].id;
}

async function main() {
  if (!TOKEN) {
    throw new Error(
      "Set TEST_JWT_TOKEN in .env first (get it from /auth/youtube login response)",
    );
  }

  const liveSessionId = await getLatestLiveSessionId(TOKEN);
  console.log("Auto-detected latest live session:", liveSessionId);

  const socket = io(`${API_BASE_URL}/moderation`, {
    auth: { token: TOKEN },
  });

  socket.on("connect", () => {
    console.log("Connected! Socket ID:", socket.id);
    socket.emit("subscribe:live-session", { liveSessionId });
  });

  socket.on("subscribed", (data) => {
    console.log("Subscribed to:", data);
  });

  socket.on("chat-message", (data) => {
    console.log("\n[NEW MESSAGE]", data);
  });

  socket.on("moderation-action", (data) => {
    console.log("\n[MODERATION ACTION]", data);
  });

  socket.on("error", (data) => {
    console.error("Error:", data);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected");
  });
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
