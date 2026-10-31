import { Request, Response } from 'express';
import { barService } from '../services/barService';

class BarController {
  // 1. Exibir painel KDS exclusivo do Bar (apenas Bebidas - categoria_id = 3)
  async exibirPainel(_req: Request, res: Response): Promise<void> {
    try {
      const pedidos = await barService.listarFilaBar();

      res.render('bar/painel', {
        titulo: 'Bar / Bebidas (KDS)',
        moduloAtual: 'bar',
        pedidos
      });
    } catch (error) {
      console.error('Erro ao carregar painel do bar:', error);
      res.status(500).send('Erro interno ao carregar o bar.');
    }
  }

  // 2. Iniciar preparo / separação das bebidas
  async iniciarPreparo(req: Request, res: Response): Promise<void> {
    try {
      const pedidoId = Number(req.params.id);
      await barService.iniciarPreparo(pedidoId);
      res.redirect('/bar');
    } catch (error) {
      console.error('Erro ao iniciar atendimento no bar:', error);
      res.status(500).send('Erro ao atualizar status do pedido no bar.');
    }
  }

  // 3. Concluir / Liberar bebidas
  async concluirPreparo(req: Request, res: Response): Promise<void> {
    try {
      const pedidoId = Number(req.params.id);
      await barService.concluirPreparo(pedidoId);
      res.redirect('/bar');
    } catch (error) {
      console.error('Erro ao concluir bebidas no bar:', error);
      res.status(500).send('Erro ao concluir pedido no bar.');
    }
  }
}

export const barController = new BarController();
export default barController;