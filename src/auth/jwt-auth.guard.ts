import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import { AuthService } from "./auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing authentication token");
    }

    try {
      const payload = this.authService.verifyToken(token);

      const isActive = await this.authService.isSessionActive(payload.jti);
      if (!isActive) {
        throw new UnauthorizedException("Session has been revoked");
      }

      request.streamerId = payload.streamerId;
      request.jti = payload.jti;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractToken(request: any): string | null {
    if (request.cookies?.auth_token) {
      return request.cookies.auth_token;
    }

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }
}
