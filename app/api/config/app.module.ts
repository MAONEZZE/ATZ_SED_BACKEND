import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './env.validation';
import { PrismaModule } from '@database/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { AuthModule } from '@database/auth/auth.module';
import { GuardsModule } from './guards/guards.module';
import { EventsModule } from '../controllers/events/events.module';
import { RegistrationsModule } from '../controllers/registrations/registrations.module';
import { WorkersModule } from '../workers/workers.module';
import { AutomationsModule } from '../controllers/automations/automations.module';
import { AiFeatureModule } from '../controllers/ai/ai.module';
import { MessagingModule } from '../controllers/messaging/messaging.module';
import { TemplatesModule } from '../controllers/templates/templates.module';
import { LandingModule } from '../controllers/landing/landing.module';
import { UsersModule } from '../controllers/users/users.module';
import { PublicModule } from '../controllers/public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    GuardsModule,
    EventsModule,
    RegistrationsModule,
    WorkersModule,
    AutomationsModule,
    AiFeatureModule,
    MessagingModule,
    TemplatesModule,
    LandingModule,
    UsersModule,
    PublicModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
