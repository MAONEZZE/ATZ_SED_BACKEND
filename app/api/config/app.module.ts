import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './env.validation';
// TODO: Uncomment after Task 3 (Prisma setup) is complete
// import { PrismaModule } from '@database/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { AuthModule } from '@database/auth/auth.module';
import { GuardsModule } from './guards/guards.module';

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
    // TODO: Uncomment after Task 3 (Prisma setup) is complete
    // PrismaModule,
    HealthModule,
    AuthModule,
    GuardsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
