import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { AuthService } from "../../auth/auth.service";
import { YouTubeAuthService } from "./youtube-auth.service";

@ApiTags("Auth")
@Controller("auth/youtube")
export class YouTubeAuthController {
  constructor(
    private youtubeAuthService: YouTubeAuthService,
    private authService: AuthService,
  ) {}

  @Get()
  redirectToGoogle(@Res() res: Response) {
    const url = this.youtubeAuthService.getAuthUrl();
    return res.redirect(url);
  }

  @Get("callback")
  async handleCallback(@Query("code") code: string, @Res() res: Response) {
    try {
      const { streamer, connection } =
        await this.youtubeAuthService.handleOAuthCallback(code);

      const token = this.authService.generateToken({
        streamerId: streamer.id,
        email: streamer.email,
      });

      // For now return JSON (later when the frontend already exists, redirect to the frontend with the token)
      return res.json({
        success: true,
        token,
        streamer: {
          id: streamer.id,
          email: streamer.email,
          displayName: streamer.displayName,
        },
        connection: {
          id: connection.id,
          platformChannelName: connection.platformChannelName,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
