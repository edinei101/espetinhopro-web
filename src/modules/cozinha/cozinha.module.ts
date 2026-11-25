import { Module } from '@nestjs/common';
import { CozinhaController } from './cozinha.controller';
import { CozinhaService } from './cozinha.service';

@Module({
  controllers: [CozinhaController],
  providers: [CozinhaService],
  exports: [CozinhaService],
})
export class CozinhaModule {}