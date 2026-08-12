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
import { EventsModule } from '@api/config/modules/events.module';
import { FormsModule } from '@api/config/modules/forms.module';
import { FormFieldsModule } from '@api/config/modules/form-fields.module';
import { CollaboratorsModule } from '@api/config/modules/collaborators.module';
import { RegistrationsModule } from '@api/config/modules/registrations.module';
import { UserSubscriptionsModule } from '@api/config/modules/user-subscriptions.module';
import { PostEventResponsesModule } from '@api/config/modules/post-event-responses.module';
import { WorkersModule } from '@api/config/modules/workers.module';
import { AutomationsModule } from '@api/config/modules/automations.module';
import { OutboxModule } from '@api/config/modules/outbox.module';
import { MessageTemplatesModule } from '@api/config/modules/message-templates.module';
import { MessageLogsModule } from '@api/config/modules/message-logs.module';
import { ProfileModule } from '@api/config/modules/profile.module';
import { WhatsappInstancesModule } from '@api/config/modules/whatsapp-instances.module';

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
    EventsModule,
    FormsModule,
    FormFieldsModule,
    CollaboratorsModule,
    RegistrationsModule,
    UserSubscriptionsModule,
    PostEventResponsesModule,
    WorkersModule,
    AutomationsModule,
    OutboxModule,
    MessageTemplatesModule,
    MessageLogsModule,
    ProfileModule,
    WhatsappInstancesModule,
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
