import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { YouTubeAuthService } from "./youtube-auth.service";

@Controller("auth/youtube")
export class YouTubeAuthController {
  constructor(private youtubeAuthService: YouTubeAuthService) {}

  /**
   * Endpoint yang di-hit dari frontend saat streamer klik "Connect YouTube".
   * Untuk sekarang, streamerId dikirim manual lewat query param
   * (nanti diganti ambil dari session/JWT login setelah auth module streamer kita ada).
   */
  @Get()
  redirectToGoogle(
    @Query("streamerId") streamerId: string,
    @Res() res: Response,
  ) {
    const url = this.youtubeAuthService.getAuthUrl(streamerId);
    return res.redirect(url);
  }

  @Get("callback")
  async handleCallback(
    @Query("code") code: string,
    @Query("state") streamerId: string,
    @Res() res: Response,
  ) {
    try {
      await this.youtubeAuthService.handleOAuthCallback(code, streamerId);
      // Nanti redirect ke dashboard frontend, untuk sekarang cukup return JSON
      return res.json({ success: true, message: "YouTube account connected" });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
