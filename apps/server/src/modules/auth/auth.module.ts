import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AppConfigService } from '../../config/app-config.service';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SmsController } from './sms/sms.controller';
import { SmsService } from './sms/sms.service';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: `${config.jwtAccessTtl}s` },
      }),
    }),
  ],
  controllers: [AuthController, SmsController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, GithubStrategy, SmsService],
  exports: [AuthService],
})
export class AuthModule {}
