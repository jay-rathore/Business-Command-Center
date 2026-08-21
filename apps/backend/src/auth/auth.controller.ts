import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface RefreshRequestUser {
  sub: string;
  refreshToken: string | null;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: FIFTEEN_MINUTES_MS,
      path: '/',
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: THIRTY_DAYS_MS,
      path: '/api/auth',
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { tokens, payload } = await this.authService.login(dto.email, dto.password);
    this.setAuthCookies(res, tokens);
    return {
      user: { id: payload.sub, email: payload.email, role: payload.roleName, permissions: payload.permissions },
    };
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request & { user: RefreshRequestUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!req.user?.refreshToken) throw new UnauthorizedException();
    const { tokens, payload } = await this.authService.refresh(req.user.sub, req.user.refreshToken);
    this.setAuthCookies(res, tokens);
    return {
      user: { id: payload.sub, email: payload.email, role: payload.roleName, permissions: payload.permissions },
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@CurrentUser('sub') userId: string, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(userId);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUser('sub') userId: string) {
    return this.authService.getMe(userId);
  }
}
