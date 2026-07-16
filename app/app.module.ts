import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from '@shared/interceptors/logging.interceptor';
import { validateEnv } from '@shared/config/env.validation';
import { PrismaModule } from '@infra/prisma/prisma.module';
import { HealthModule } from '@shared/health/health.module';
import { RequestIdMiddleware } from '@shared/middleware/request-id.middleware';
import { AuthModule } from '@infra/auth/auth.module';
import { GuardsModule } from '@shared/guards/guards.module';
import { EventsModule } from '@modules/events/events.module';
import { RegistrationsModule } from '@modules/registrations/registrations.module';
import { WorkersModule } from '@workers/workers.module';
import { AutomationsModule } from '@modules/automations/automations.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { GlobalMessagingModule } from '@modules/messaging/global-messaging.module';
import { UsersModule } from '@modules/users/users.module';
import { PublicModule } from '@modules/public/public.module';
import { EvolutionInstancesModule } from '@modules/evolution-instances/evolution-instances.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: false,
        quietReqLogger: true,
        redact: ['req.headers.authorization'],
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, singleLine: true, ignore: 'pid,hostname' },
        },
      },
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    GuardsModule,
    EventsModule,
    RegistrationsModule,
    WorkersModule,
    AutomationsModule,
    MessagingModule,
    GlobalMessagingModule,
    UsersModule,
    PublicModule,
    EvolutionInstancesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
