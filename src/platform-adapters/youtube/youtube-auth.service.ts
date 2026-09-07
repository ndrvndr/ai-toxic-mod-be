import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";
import { db } from "../../prisma/db";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

@Injectable()
export class YouTubeAuthService {
  private readonly logger = new Logger(YouTubeAuthService.name);

  constructor(private configService: ConfigService) {}

  private createOAuthClient() {
    return new google.auth.OAuth2(
      this.configService.get<string>("YOUTUBE_CLIENT_ID"),
      this.configService.get<string>("YOUTUBE_CLIENT_SECRET"),
      this.configService.get<string>("YOUTUBE_REDIRECT_URI"),
    );
  }

  getAuthUrl(): string {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: YOUTUBE_SCOPES,
    });
  }

  /**
   * Login/signup + connect YouTube in one flow.
   * Return streamers who have successfully logged in (newly created or existing) along with their connections.
   */
  async handleOAuthCallback(code: string) {
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("No access_token returned from Google");
    }

    client.setCredentials(tokens);

    // Ambil profile (email, nama) buat identitas Streamer
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const profile = await oauth2.userinfo.get();

    if (!profile.data.email) {
      throw new Error("Could not retrieve email from Google profile");
    }

    // Retrieve YouTube channel info for PlatformConnection identity
    const youtube = google.youtube({ version: "v3", auth: client });
    const channelResponse = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel?.id) {
      throw new Error("Could not retrieve YouTube channel info");
    }

    // Find-or-create Streamer based on email
    let streamer = await db.orm.public.Streamer.where({
      email: profile.data.email,
    }).first();

    if (!streamer) {
      streamer = await db.orm.public.Streamer.create({
        email: profile.data.email,
        displayName: profile.data.name ?? undefined,
      });
      this.logger.log(`Created new streamer: ${streamer.email}`);
    }

    if (!streamer) {
      throw new Error("Failed to create or find streamer");
    }

    // Find-or-create PlatformConnection
    const existingConnection = await db.orm.public.PlatformConnection.where({
      streamerId: streamer.id,
      platform: "youtube",
      platformUserId: channel.id,
    }).first();

    const connectionData = {
      streamerId: streamer.id,
      platform: "youtube" as const,
      platformUserId: channel.id,
      platformChannelName: channel.snippet?.title ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      tokenExpiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : undefined,
      scopes: YOUTUBE_SCOPES,
      isActive: true,
    };

    const connection = existingConnection
      ? await db.orm.public.PlatformConnection.where({
          id: existingConnection.id,
        }).update(connectionData)
      : await db.orm.public.PlatformConnection.create(connectionData);

    if (!connection) {
      throw new Error("Failed to create or update platform connection");
    }

    return { streamer, connection };
  }

  async refreshAccessToken(connectionId: string) {
    const connection = await db.orm.public.PlatformConnection.where({
      id: connectionId,
    }).first();

    if (!connection?.refreshToken) {
      throw new Error("No refresh_token available for this connection");
    }

    const client = this.createOAuthClient();
    client.setCredentials({ refresh_token: connection.refreshToken });

    const { credentials } = await client.refreshAccessToken();

    return db.orm.public.PlatformConnection.where({ id: connectionId }).update({
      accessToken: credentials.access_token!,
      tokenExpiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : undefined,
    });
  }
}
