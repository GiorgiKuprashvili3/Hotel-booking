import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS — allow Angular dev server + websockets
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:3001'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('LuxStay API')
    .setDescription('Hotel Management System REST API — Phases 1–6 complete')
    .setVersion('2.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth',          'Authentication & token refresh')
    .addTag('Staff',         'Staff management & invites')
    .addTag('Properties',    'Hotel properties')
    .addTag('Rooms',         'Rooms & room types')
    .addTag('Guests',        'Guest profiles')
    .addTag('Rate Plans',    'Rate plan management')
    .addTag('Reservations',  'Bookings, check-in & check-out')
    .addTag('Folio',         'Guest billing & payments')
    .addTag('Housekeeping',  'Housekeeping tasks')
    .addTag('Maintenance',   'Maintenance requests')
    .addTag('Concierge',     'Concierge requests')
    .addTag('Loyalty',       'Loyalty points ledger')
    .addTag('Analytics',     'Occupancy, revenue & KPI snapshots')
    .addTag('Audit',         'Immutable audit trail')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`\n🏨  LuxStay API running on  http://localhost:${port}/api/v1`);
  console.log(`📖  Swagger docs at         http://localhost:${port}/api/docs`);
  console.log(`🔌  WebSocket gateway at    ws://localhost:${port}/realtime\n`);
}

bootstrap();
