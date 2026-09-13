import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable } from "@nestjs/common";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (SAFE_METHODS.includes(request.method)) {
      return true;
    }

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return true;
    }

    const cookieToken = request.cookies?.csrf_token;
    const headerToken = request.headers["x-csrf-token"];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException("Invalid or missing CSRF token");
    }

    return true;
  }
}
