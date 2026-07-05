import { WebSocket } from 'ws';
(globalThis as any).WebSocket ??= WebSocket;

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const bodyLimit = process.env.BODY_LIMIT as string;
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });

  app.use(
    helmet({
      contentSecurityPolicy: process.env.ENVIROMENT === 'dev' ? false : undefined,
    }),
  );
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  if (process.env.ENVIROMENT === 'dev') {
    const config = new DocumentBuilder()
      .setTitle('SED API')
      .setDescription('Save Event Date — API de gerenciamento de eventos')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Events', 'CRUD e ciclo de vida dos eventos')
      .addTag('Form Fields', 'Campos do formulário de inscrição')
      .addTag('Templates', 'Templates de mensagens WhatsApp/Email')
      .addTag('Automations', 'Regras de automação de disparo')
      .addTag('Registrations', 'Inscrições e funil de aprovação')
      .addTag('Messaging', 'Envio manual e logs de mensagens')
      .addTag('Profile', 'Perfil do usuário autenticado')
      .addTag('Public', 'Endpoints públicos — sem autenticação')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
