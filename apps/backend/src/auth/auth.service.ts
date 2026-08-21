import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { ttlToSeconds } from '../common/utils/ttl';

const REFRESH_HASH_ROUNDS = 10;

type UserWithRoleAndExec = Prisma.UserGetPayload<{
  include: { role: true; salesExecutive: true };
}>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly permissions: PermissionsService,
  ) {}

  private requireEnv(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) throw new Error(`Missing required env var: ${key}`);
    return value;
  }

  async validateCredentials(email: string, password: string): Promise<UserWithRoleAndExec> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true, salesExecutive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  async issueTokens(user: UserWithRoleAndExec): Promise<{ tokens: AuthTokens; payload: JwtPayload }> {
    const permissionCodes = await this.permissions.getPermissionCodesForRole(user.roleId);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: permissionCodes,
      salesExecutiveId: user.salesExecutive?.id ?? null,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.requireEnv('JWT_ACCESS_SECRET'),
      expiresIn: ttlToSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
    });
    const refreshToken = this.jwt.sign(
      { sub: user.id },
      {
        secret: this.requireEnv('JWT_REFRESH_SECRET'),
        expiresIn: ttlToSeconds(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d'),
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, REFRESH_HASH_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash, lastLoginAt: new Date() },
    });

    return { tokens: { accessToken, refreshToken }, payload };
  }

  async login(email: string, password: string) {
    const user = await this.validateCredentials(email, password);
    return this.issueTokens(user);
  }

  async refresh(userId: string, providedRefreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, salesExecutive: true },
    });

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session expired, please log in again');
    }

    const matches = await bcrypt.compare(providedRefreshToken, user.refreshTokenHash);
    if (!matches) {
      // Reuse of a stale/rotated token — theft-detection: force a full logout.
      await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
      throw new UnauthorizedException('Session invalid, please log in again');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, salesExecutive: true },
    });
    if (!user) throw new UnauthorizedException();

    const permissionCodes = await this.permissions.getPermissionCodesForRole(user.roleId);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role.name,
      permissions: permissionCodes,
      salesExecutiveId: user.salesExecutive?.id ?? null,
    };
  }
}
