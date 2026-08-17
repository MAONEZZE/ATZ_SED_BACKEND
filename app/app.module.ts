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
import { AuthModule } from '@shared/modules/auth.module';
import { GuardsModule } from '@shared/modules/guards.module';
import { EventModule } from '@shared/modules/event.module';
import { FolderModule } from '@shared/modules/folder.module';
import { FormModule } from '@shared/modules/form.module';
import { FormFieldModule } from '@shared/modules/form-field.module';
import { CollaboratorModule } from '@shared/modules/collaborator.module';
import { RegistrationModule } from '@shared/modules/registration.module';
import { UserSubscriptionModule } from '@shared/modules/user-subscription.module';
import { PostEventResponseModule } from '@shared/modules/post-event-response.module';
import { WorkersModule } from '@shared/modules/workers.module';
import { AutomationModule } from '@shared/modules/automation.module';
import { OutboxModule } from '@shared/modules/outbox.module';
import { MessageTemplateModule } from '@shared/modules/message-template.module';
import { MessageLogModule } from '@shared/modules/message-log.module';
import { ProfileModule } from '@shared/modules/profile.module';
import { WhatsappInstanceModule } from '@shared/modules/whatsapp-instance.module';

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
    FolderModule,
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
