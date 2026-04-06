import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const raw = process.env.FRONTEND_URL || 'http://localhost:3000';
  const origins = raw.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length <= 1 ? origins[0] || 'http://localhost:3000' : origins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads/' });
  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);
}
bootstrap();
