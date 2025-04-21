import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Navark API')
    .setDescription(
      'API oficial de Navark, un juego multijugador de batalla naval. Gestiona usuarios, partidas, rankings, equipos y lógica de juego en tiempo real. Esta documentación cubre los endpoints públicos y privados utilizados por el cliente web y servicios internos.',
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
