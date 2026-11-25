import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { RelatoriosService } from './relatorios.service';
import { FiltroRelatorioDto } from './dtos/relatorios.dto';

@Controller('relatorios')
export class RelatoriosController {
  constructor(
    @Inject(RelatoriosService)
    private readonly relatoriosService: RelatoriosService,
  ) {
    this.index = this.index.bind(this);
  }

  private getService(): RelatoriosService {
    return this.relatoriosService || new RelatoriosService();
  }

  @Get()
  async index(
    @Query() filtro: FiltroRelatorioDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) {
        return res.redirect('/login');
      }

      // Validação de permissão
      if (session.usuario.acesso_relatorios === 0) {
        return res.redirect('/inicio?erro=Acesso+negado+ao+modulo+de+relatorios');
      }

      const hoje = new Date().toISOString().split('T')[0];
      const dataInicio = filtro.data_inicio || filtro.dataInicio || hoje;
      const dataFim = filtro.data_fim || filtro.dataFim || hoje;

      const dados = await this.getService().obterDadosRelatorio({
        dataInicio,
        dataFim,
      });

      res.render('relatorios/index', {
        titulo: 'Relatórios Financeiros & Vendas',
        moduloAtual: 'relatorios',
        usuario: session.usuario,
        dataInicio,
        dataFim,
        ...dados,
      });
    } catch (error) {
      console.error('Erro ao processar relatório:', error);
      res.status(500).send('Erro interno ao gerar o relatório.');
    }
  }
}