import { Request, Response } from 'express';
import { balcaoService } from '../services/balcaoService';

class BalcaoController {
  // 1. Listar comandas ativas em cards
  async listarComandas(_req: Request, res: Response): Promise<void> {
    try {
      const comandas = await balcaoService.listarComandas();

      res.render('balcao/painel', {
        titulo: 'Balcão / Rápido',
        moduloAtual: 'balcao',
        comandas
      });
    } catch (error) {
      console.error('Erro ao listar balcão:', error);
      res.status(500).send('Erro interno ao listar comandas do balcão.');
    }
  }

  // 2. Abrir nova comanda de balcão
  async abrirComanda(req: Request, res: Response): Promise<void> {
    try {
      const nomeCliente = (req.body.nome_cliente && req.body.nome_cliente.trim() !== '')
        ? req.body.nome_cliente.trim()
        : 'Cliente Balcão';
      const atendenteId = (req as any).session?.idUsuario || 1;

      const novaComandaId = await balcaoService.abrirComanda(nomeCliente, atendenteId);

      res.redirect(`/balcao/comanda/${novaComandaId}`);
    } catch (error) {
      console.error('Erro ao abrir comanda de balcão:', error);
      res.status(500).send('Erro ao abrir nova comanda.');
    }
  }

  // 3. Exibir detalhes do balcão
  async exibirComanda(req: Request, res: Response): Promise<void> {
    try {
      const comandaId = Number(req.params.id);
      const detalhes = await balcaoService.obterDetalhesComanda(comandaId);

      if (!detalhes) {
        return res.redirect('/balcao');
      }

      res.render('balcao/detalhes', {
        titulo: `Comanda Balcão #${comandaId}`,
        moduloAtual: 'balcao',
        ...detalhes
      });
    } catch (error) {
      console.error('Erro ao exibir comanda balcão:', error);
      res.status(500).send('Erro ao carregar detalhes da comanda.');
    }
  }

  // 4. Lançar item
  async adicionarItem(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      const produtoId = Number(req.body.produto_id);
      const quantidade = Math.max(1, Number(req.body.quantidade) || 1);
      const pontoCarne = req.body.ponto_carne ? String(req.body.ponto_carne).trim() : null;
      const observacao = req.body.observacao ? String(req.body.observacao).trim() : null;
      const usuarioId = (req as any).session?.idUsuario || 1;

      await balcaoService.adicionarItem({
        comandaId,
        produtoId,
        quantidade,
        pontoCarne,
        observacao,
        usuarioId
      });

      res.redirect(`/balcao/comanda/${comandaId}`);
    } catch (error) {
      console.error('Erro ao adicionar item no balcão:', error);
      res.redirect(`/balcao/comanda/${comandaId}`);
    }
  }

  // 5. Excluir item
  async removerItem(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      const itemId = Number(req.params.itemId);
      await balcaoService.removerItem(comandaId, itemId);

      res.redirect(`/balcao/comanda/${comandaId}`);
    } catch (error) {
      console.error('Erro ao remover item do balcão:', error);
      res.redirect(`/balcao/comanda/${comandaId}`);
    }
  }

  // 6. Enviar pedidos para produção
  async enviarProducao(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      await balcaoService.enviarProducao(comandaId);
      res.redirect(`/balcao/comanda/${comandaId}`);
    } catch (error) {
      console.error('Erro ao enviar balcão para produção:', error);
      res.redirect(`/balcao/comanda/${comandaId}`);
    }
  }

  // 7. Cancelar Comanda
  async cancelarComanda(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      await balcaoService.cancelarComanda(comandaId);
      res.redirect('/balcao');
    } catch (error) {
      console.error('Erro ao cancelar comanda de balcão:', error);
      res.redirect(`/balcao/comanda/${comandaId}`);
    }
  }

  // 8. Encerrar Balcão
  async solicitarFechamento(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      await balcaoService.solicitarFechamento(comandaId);
      res.redirect('/balcao');
    } catch (error) {
      console.error('Erro ao fechar balcão:', error);
      res.redirect(`/balcao/comanda/${comandaId}`);
    }
  }
}

export default new BalcaoController();