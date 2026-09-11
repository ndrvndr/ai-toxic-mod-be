import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { AuthService } from "../../auth/auth.service";
import { YouTubeAuthService } from "./youtube-auth.service";

const COOKIE_NAME = "auth_token";
const isProduction = process.env.NODE_ENV === "production";

@ApiTags("Auth")
@Controller("auth")
export class YouTubeAuthController {
  constructor(
    private youtubeAuthService: YouTubeAuthService,
    private authService: AuthService,
  ) {}

  @Get("login")
  redirectToGoogle(@Res() res: Response) {
    const url = this.youtubeAuthService.getAuthUrl();
    return res.redirect(url);
  }

  @Get("youtube/callback")
  async handleCallback(@Query("code") code: string, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3001";

    try {
      const { streamer } =
        await this.youtubeAuthService.handleOAuthCallback(code);

      const token = this.authService.generateToken({
        streamerId: streamer.id,
        email: streamer.email,
      });

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      return res.redirect(`${frontendUrl}/auth/callback`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(message)}`,
      );
    }
  }

  @Get("logout")
  logout(@Res() res: Response) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3001";
    return res.redirect(`${frontendUrl}/login`);
  }
}
