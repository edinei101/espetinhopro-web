import { Request, Response } from 'express';
import { cozinhaService } from '../services/cozinhaService';

class CozinhaController {
  // 1. Exibir painel KDS exclusivo da Cozinha / Grelha
  async exibirPainel(_req: Request, res: Response): Promise<void> {
    try {
      const pedidos = await cozinhaService.listarFilaCozinha();

      res.render('cozinha/painel', {
        titulo: 'Cozinha / Grelha (KDS)',
        moduloAtual: 'cozinha',
        pedidos
      });
    } catch (error) {
      console.error('Erro ao carregar painel da cozinha:', error);
      res.status(500).send('Erro interno ao carregar a cozinha.');
    }
  }

  // 2. Mudar status para EM_PREPARO
  async iniciarPreparo(req: Request, res: Response): Promise<void> {
    try {
      const pedidoId = Number(req.params.id);
      await cozinhaService.iniciarPreparo(pedidoId);
      res.redirect('/cozinha');
    } catch (error) {
      console.error('Erro ao iniciar preparo:', error);
      res.status(500).send('Erro ao atualizar status do pedido.');
    }
  }

  // 3. Mudar status para PRONTO
  async concluirPreparo(req: Request, res: Response): Promise<void> {
    try {
      const pedidoId = Number(req.params.id);
      await cozinhaService.concluirPreparo(pedidoId);
      res.redirect('/cozinha');
    } catch (error) {
      console.error('Erro ao concluir preparo:', error);
      res.status(500).send('Erro ao concluir pedido.');
    }
  }
}

export const cozinhaController = new CozinhaController();
export default cozinhaController;