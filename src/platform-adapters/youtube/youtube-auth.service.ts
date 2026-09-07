import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";

import { PrismaService } from "../../prisma.service";

const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];

@Injectable()
export class YouTubeAuthService {
  private readonly logger = new Logger(YouTubeAuthService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  private createOAuthClient() {
    const redirectUri = this.configService.get<string>("YOUTUBE_REDIRECT_URI");
    console.log("REDIRECT URI FROM ENV:", JSON.stringify(redirectUri));
    return new google.auth.OAuth2(
      this.configService.get<string>("YOUTUBE_CLIENT_ID"),
      this.configService.get<string>("YOUTUBE_CLIENT_SECRET"),
      this.configService.get<string>("YOUTUBE_REDIRECT_URI"),
    );
  }

  /**
   * Construct the URL that will redirect the streamer for login and consent.
   * The `state` parameter is used to identify which streamer is connecting,
   * when Google redirects back to our callback.
   */
  getAuthUrl(streamerId: string): string {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: "offline", // Mandatory, so you can refresh_token
      prompt: "consent", // Force the consent screen to appear every time so that a `refresh_token` is always issued.
      scope: YOUTUBE_SCOPES,
      state: streamerId,
    });
  }

  /**
   * Exchange the authorization code (from the callback query parameters) for tokens,
   * then save or update the connection in the platform_connections table.
   */
  async handleOAuthCallback(code: string, streamerId: string) {
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("No access_token returned from Google");
    }

    // Retrieve channel info for the newly logged-in user, to be saved as their identity
    client.setCredentials(tokens);
    const youtube = google.youtube({ version: "v3", auth: client });
    const channelResponse = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel?.id) {
      throw new Error("Could not retrieve YouTube channel info");
    }

    const connection = await this.prisma.db.orm.public.PlatformConnection.where(
      {
        streamerId,
        platform: "youtube",
        platformUserId: channel.id,
      },
    ).first();

    const data = {
      streamerId,
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

    if (connection) {
      return this.prisma.db.orm.public.PlatformConnection.where({
        id: connection.id,
      }).update(data);
    }

    return this.prisma.db.orm.public.PlatformConnection.create(data);
  }

  /**
   * Refresh access tokens that have/will expire.
   */
  async refreshAccessToken(connectionId: string) {
    const connection = await this.prisma.db.orm.public.PlatformConnection.where(
      {
        id: connectionId,
      },
    ).first();

    if (!connection?.refreshToken) {
      throw new Error("No refresh_token available for this connection");
    }

    const client = this.createOAuthClient();
    client.setCredentials({ refresh_token: connection.refreshToken });

    const { credentials } = await client.refreshAccessToken();

    return this.prisma.db.orm.public.PlatformConnection.where({
      id: connectionId,
    }).update({
      accessToken: credentials.access_token!,
      tokenExpiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : undefined,
    });
  }
}
