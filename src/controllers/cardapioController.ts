import { Request, Response } from 'express';
import { cardapioService } from '../services/cardapioService';

class CardapioController {
  // 1. Listagem dos produtos por aba/categoria
  async listar(req: Request, res: Response): Promise<void> {
    try {
      const categoriaAtiva = req.query.categoria ? Number(req.query.categoria) : 1;
      const mensagem = req.query.msg ? String(req.query.msg) : null;
      const erro = req.query.erro ? String(req.query.erro) : null;

      const { produtos, todosAcompanhamentos } = await cardapioService.listarPorCategoria(categoriaAtiva);

      res.render('cardapio/listar', {
        titulo: 'Gestão de Cardápio',
        moduloAtual: 'cardapio',
        categoriaAtiva,
        produtos,
        todosAcompanhamentos,
        mensagem,
        erro
      });
    } catch (error) {
      console.error('Erro ao listar cardápio:', error);
      res.status(500).send('Erro interno ao listar cardápio.');
    }
  }

  // 2. Criar novo item no cardápio
  async criar(req: Request, res: Response): Promise<void> {
    const categoriaId = Number(req.body.categoria_id) || 1;
    try {
      const nome = req.body.nome ? req.body.nome.trim() : '';

      if (!nome) {
        return res.redirect(`/cardapio?categoria=${categoriaId}&erro=O nome do item é obrigatório.`);
      }

      const controlaEstoque = req.body.controla_estoque === 'on' || req.body.controla_estoque === '1' ? 1 : 0;
      const quantidadeEstoque = controlaEstoque ? Math.max(0, parseInt(req.body.quantidade_estoque, 10) || 0) : 0;
      const requerPontoCarne = req.body.requer_ponto_carne === 'on' || req.body.requer_ponto_carne === '1' ? 1 : 0;
      const preco = Math.max(0, parseFloat(String(req.body.preco).replace(',', '.')) || 0);
      const descricao = req.body.descricao && req.body.descricao.trim() !== '' ? req.body.descricao.trim() : null;

      await cardapioService.criarItem({
        categoriaId,
        nome,
        descricao,
        preco,
        controlaEstoque,
        quantidadeEstoque,
        requerPontoCarne,
        acompanhamentos: req.body.acompanhamentos
      });

      res.redirect(`/cardapio?categoria=${categoriaId}&msg=Item cadastrado com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao cadastrar produto:', error);
      res.redirect(`/cardapio?categoria=${categoriaId}&erro=${encodeURIComponent(error.message || 'Erro ao cadastrar item no cardápio.')}`);
    }
  }

  // 3. Atualizar item existente
  async atualizar(req: Request, res: Response): Promise<void> {
    const categoriaId = Number(req.body.categoria_id) || 1;
    try {
      const id = Number(req.params.id);
      const nome = req.body.nome ? req.body.nome.trim() : '';

      if (!nome) {
        return res.redirect(`/cardapio?categoria=${categoriaId}&erro=O nome do item é obrigatório na edição.`);
      }

      const controlaEstoque = req.body.controla_estoque === 'on' || req.body.controla_estoque === '1' ? 1 : 0;
      const quantidadeEstoque = controlaEstoque ? Math.max(0, parseInt(req.body.quantidade_estoque, 10) || 0) : 0;
      const requerPontoCarne = req.body.requer_ponto_carne === 'on' || req.body.requer_ponto_carne === '1' ? 1 : 0;
      const preco = Math.max(0, parseFloat(String(req.body.preco).replace(',', '.')) || 0);
      const descricao = req.body.descricao && req.body.descricao.trim() !== '' ? req.body.descricao.trim() : null;

      await cardapioService.atualizarItem(id, {
        categoriaId,
        nome,
        descricao,
        preco,
        controlaEstoque,
        quantidadeEstoque,
        requerPontoCarne,
        acompanhamentos: req.body.acompanhamentos
      });

      res.redirect(`/cardapio?categoria=${categoriaId}&msg=Item atualizado com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      res.redirect(`/cardapio?categoria=${categoriaId}&erro=${encodeURIComponent(error.message || 'Erro ao atualizar item do cardápio.')}`);
    }
  }

  // 4. Excluir item (Soft Delete)
  async excluir(req: Request, res: Response): Promise<void> {
    const categoriaId = req.query.categoria ? Number(req.query.categoria) : 1;
    try {
      const id = Number(req.params.id);

      await cardapioService.excluirItem(id);

      res.redirect(`/cardapio?categoria=${categoriaId}&msg=Item removido do cardápio!`);
    } catch (error: any) {
      console.error('Erro ao excluir produto:', error);
      res.redirect(`/cardapio?categoria=${categoriaId}&erro=${encodeURIComponent(error.message || 'Erro ao excluir item do cardápio.')}`);
    }
  }
}

export const cardapioController = new CardapioController();
export default cardapioController;