import { Module } from '@nestjs/common';
import { BalcaoController } from './balcao.controller';
import { BalcaoService } from './balcao.service';

@Module({
  controllers: [BalcaoController],
  providers: [BalcaoService],
  exports: [BalcaoService],
})
export class BalcaoModule {}