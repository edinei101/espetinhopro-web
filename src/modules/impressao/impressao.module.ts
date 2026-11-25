import { Module } from '@nestjs/common';
import { ImpressaoController } from './impressao.controller';
import { ImpressaoService } from './impressao.service';

@Module({
  controllers: [ImpressaoController],
  providers: [ImpressaoService],
  exports: [ImpressaoService],
})
export class ImpressaoModule {}