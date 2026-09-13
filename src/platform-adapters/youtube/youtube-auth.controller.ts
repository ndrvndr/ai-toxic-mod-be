import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { randomBytes } from "crypto";
import type { Response } from "express";

import { AuthService } from "../../auth/auth.service";
import { CurrentStreamer } from "../../auth/current-streamer.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { db } from "../../prisma/db";
import { YouTubeAuthService } from "./youtube-auth.service";

const COOKIE_NAME = "auth_token";
const isProduction = process.env.NODE_ENV === "production";
const CSRF_COOKIE_NAME = "csrf_token";

@ApiTags("Auth")
@Controller("auth")
export class YouTubeAuthController {
  constructor(
    private youtubeAuthService: YouTubeAuthService,
    private authService: AuthService,
  ) {}

  @Get("login")
  @SkipThrottle()
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

      const token = await this.authService.generateToken({
        streamerId: streamer.id,
        email: streamer.email,
      });

      const csrfToken = randomBytes(32).toString("hex");

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.cookie(CSRF_COOKIE_NAME, csrfToken, {
        httpOnly: false,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      return res.redirect(`${frontendUrl}/auth/callback`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent(message)}`,
      );
    }
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any, @Res() res: Response) {
    if (req.jti) {
      await this.authService.revokeSession(req.jti);
    }

    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
    return res.json({ success: true });
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  async getCurrentStreamer(@CurrentStreamer() streamerId: string) {
    const streamer = await db.orm.public.Streamer.where({
      id: streamerId,
    }).first();

    if (!streamer) {
      return { data: null };
    }

    return {
      data: {
        id: streamer.id,
        email: streamer.email,
        displayName: streamer.displayName,
      },
    };
  }
}
