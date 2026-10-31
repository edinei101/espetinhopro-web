import { Request, Response } from 'express';
import { mesaService } from '../services/mesaService';

// Função auxiliar desacoplada do escopo da classe (evita perda do 'this')
function obterAtendenteId(req: Request): number {
  const id = (req as any).session?.idUsuario ?? (req as any).session?.usuario?.id;
  return id && Number(id) > 0 ? Number(id) : 1;
}

class MesaController {
  // 1. Listar mesas e status no salão
  async listarMesas(_req: Request, res: Response): Promise<void> {
    try {
      const mesas = await mesaService.listarPainel();

      res.render('mesas/painel', {
        titulo: 'Salão de Mesas',
        moduloAtual: 'mesas',
        mesas
      });
    } catch (error) {
      console.error('Erro ao listar mesas:', error);
      res.status(500).send('Erro interno ao buscar mesas.');
    }
  }

  // 2. Abrir comanda na mesa
  async abrirComandaMesa(req: Request, res: Response): Promise<void> {
    try {
      const mesaId = Number(req.body.mesa_id);
      const nomeCliente = (req.body.nome_cliente && req.body.nome_cliente.trim() !== '')
        ? req.body.nome_cliente.trim()
        : 'Cliente';
      const atendenteId = obterAtendenteId(req);

      const novaComandaId = await mesaService.abrirComanda(mesaId, nomeCliente, atendenteId);

      res.redirect(`/mesas/comanda/${novaComandaId}`);
    } catch (error: any) {
      console.error('Erro ao abrir comanda de mesa:', error);
      res.status(500).send('Erro ao abrir atendimento da mesa.');
    }
  }

  // 3. Exibir detalhes da comanda da mesa
  async exibirComandaMesa(req: Request, res: Response): Promise<void> {
    try {
      const comandaId = Number(req.params.id);
      const detalhes = await mesaService.obterDetalhesComanda(comandaId);

      if (!detalhes) {
        return res.redirect('/mesas');
      }

      res.render('mesas/detalhes', {
        titulo: `Mesa ${detalhes.comanda.mesa_numero}`,
        moduloAtual: 'mesas',
        ...detalhes
      });
    } catch (error) {
      console.error('Erro ao carregar comanda da mesa:', error);
      res.status(500).send('Erro ao carregar comanda da mesa.');
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
      const usuarioId = obterAtendenteId(req);

      await mesaService.adicionarItem({
        comandaId,
        produtoId,
        quantidade,
        pontoCarne,
        observacao,
        usuarioId
      });

      res.redirect(`/mesas/comanda/${comandaId}`);
    } catch (error) {
      console.error('Erro ao adicionar item na mesa:', error);
      res.redirect(`/mesas/comanda/${comandaId}`);
    }
  }

  // 5. Excluir item
  async removerItem(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      const itemId = Number(req.params.itemId);
      await mesaService.removerItem(comandaId, itemId);
      res.redirect(`/mesas/comanda/${comandaId}`);
    } catch (error) {
      console.error('Erro ao remover item da mesa:', error);
      res.redirect(`/mesas/comanda/${comandaId}`);
    }
  }

  // 6. Enviar pedidos para produção
  async enviarProducao(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      await mesaService.enviarProducao(comandaId);
      res.redirect(`/mesas/comanda/${comandaId}`);
    } catch (error) {
      console.error('Erro ao enviar mesa para produção:', error);
      res.redirect(`/mesas/comanda/${comandaId}`);
    }
  }

  // 7. Cancelar Comanda
  async cancelarComanda(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      await mesaService.cancelarComanda(comandaId);
      res.redirect('/mesas');
    } catch (error) {
      console.error('Erro ao cancelar comanda de mesa:', error);
      res.redirect(`/mesas/comanda/${comandaId}`);
    }
  }

  // 8. Encerrar Mesa
  async solicitarFechamento(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      await mesaService.solicitarFechamento(comandaId);
      res.redirect('/mesas');
    } catch (error) {
      console.error('Erro ao fechar mesa:', error);
      res.redirect(`/mesas/comanda/${comandaId}`);
    }
  }
}

export const mesaController = new MesaController();
export default mesaController;