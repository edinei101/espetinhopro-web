import { Controller, Get, Param, Query, Req, Res, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { ImpressaoService } from './impressao.service';

@Controller('impressao')
export class ImpressaoController {
  constructor(
    @Inject(ImpressaoService)
    private readonly impressaoService: ImpressaoService,
  ) {
    this.imprimirConta = this.imprimirConta.bind(this);
    this.imprimirProducao = this.imprimirProducao.bind(this);
  }

  private getService(): ImpressaoService {
    return this.impressaoService || new ImpressaoService();
  }

  // Rota: GET /impressao/conta/:comandaId
  @Get('conta/:comandaId')
  async imprimirConta(
    @Param('comandaId') comandaId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) {
        res.redirect('/login');
        return;
      }

      const dados = await this.getService().obterDadosConta(Number(comandaId));
      if (!dados) {
        res.status(404).send('Comanda não encontrada.');
        return;
      }

      res.render('impressao/cupom-conta', {
        ...dados,
        usuarioEmissor: session.usuario.nome,
        dataEmissao: new Date().toLocaleString('pt-BR'),
      });
    } catch (error) {
      console.error('Erro ao gerar cupom de conta:', error);
      res.status(500).send('Erro ao gerar cupom de impressão.');
    }
  }

  @Get('producao/:comandaId')
  async imprimirProducao(
    @Param('comandaId') comandaId: string,
    @Query('setor') setor: 'COZINHA' | 'BAR',
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) {
        res.redirect('/login');
        return;
      }

      const dados = await this.getService().obterOrdemProducao(Number(comandaId), setor);
      if (!dados) {
        res.status(404).send('Comanda não encontrada.');
        return;
      }

      res.render('impressao/cupom-producao', {
        ...dados,
        usuarioEmissor: session.usuario.nome,
        dataEmissao: new Date().toLocaleString('pt-BR'),
      });
    } catch (error) {
      console.error('Erro ao gerar ordem de produção:', error);
      res.status(500).send('Erro ao gerar ordem de produção.');
    }
  }
}