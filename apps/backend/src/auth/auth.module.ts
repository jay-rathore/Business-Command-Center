import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  // JwtModule registered with no default secret/expiry — AuthService signs access and
  // refresh tokens with two different secrets/TTLs explicitly per call.
  imports: [PassportModule, JwtModule.register({}), RbacModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
