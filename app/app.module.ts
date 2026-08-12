import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from '@api/config/interceptors/logging.interceptor';
import { validateEnv } from '@shared/config/env.validation';
import { PrismaModule } from '@infra/prisma/prisma.module';
import { RequestIdMiddleware } from '@api/config/middlewares/request-id.middleware';
import { AuthModule } from '@api/config/modules/auth.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { EventModule } from '@api/config/modules/event.module';
import { FormModule } from '@api/config/modules/form.module';
import { FormFieldModule } from '@api/config/modules/form-field.module';
import { CollaboratorModule } from '@api/config/modules/collaborator.module';
import { RegistrationModule } from '@api/config/modules/registration.module';
import { UserSubscriptionModule } from '@api/config/modules/user-subscription.module';
import { PostEventResponseModule } from '@api/config/modules/post-event-response.module';
import { WorkersModule } from '@api/config/modules/workers.module';
import { AutomationModule } from '@api/config/modules/automation.module';
import { OutboxModule } from '@api/config/modules/outbox.module';
import { MessageTemplateModule } from '@api/config/modules/message-template.module';
import { MessageLogModule } from '@api/config/modules/message-log.module';
import { ProfileModule } from '@api/config/modules/profile.module';
import { WhatsappInstanceModule } from '@api/config/modules/whatsapp-instance.module';

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
    AuthModule,
    GuardsModule,
    EventModule,
    FormModule,
    FormFieldModule,
    CollaboratorModule,
    RegistrationModule,
    UserSubscriptionModule,
    PostEventResponseModule,
    WorkersModule,
    AutomationModule,
    OutboxModule,
    MessageTemplateModule,
    MessageLogModule,
    ProfileModule,
    WhatsappInstanceModule,
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
