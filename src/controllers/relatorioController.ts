import { Request, Response } from 'express';
import { relatorioService } from '../services/relatorioService';

export class RelatorioController {
  async index(req: Request, res: Response): Promise<void> {
    try {
      // Data padrão: hoje (ano-mês-dia)
      const dataAtual = new Date();
      const hoje = dataAtual.toISOString().split('T')[0];

      const dataInicio = (req.query.data_inicio as string) || hoje;
      const dataFim = (req.query.data_fim as string) || hoje;

      const dados = await relatorioService.obterDadosRelatorio({
        dataInicio,
        dataFim
      });

      res.render('relatorios/index', {
        titulo: 'Relatórios Financeiros & Vendas',
        moduloAtual: 'relatorios',
        dataInicio,
        dataFim,
        ...dados
      });
    } catch (error) {
      console.error('Erro ao processar relatório:', error);
      res.status(500).send('Erro interno ao gerar o relatório.');
    }
  }
}

export const relatorioController = new RelatorioController();