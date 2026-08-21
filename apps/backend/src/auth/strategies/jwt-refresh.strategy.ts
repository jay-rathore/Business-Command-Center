import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

function extractRefreshTokenFromCookie(req: Request): string | null {
  return (req?.cookies?.refresh_token as string | undefined) ?? null;
}

interface RefreshTokenPayload {
  sub: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('Missing required env var: JWT_REFRESH_SECRET');
    super({
      jwtFromRequest: extractRefreshTokenFromCookie,
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload) {
    return { sub: payload.sub, refreshToken: extractRefreshTokenFromCookie(req) };
  }
}
