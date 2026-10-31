import { Request, Response } from 'express';
import { estoqueService } from '../services/estoqueService';

class EstoqueController {
  private extrairUsuarioId(req: Request): number | null {
    const raw = (req as any).session?.idUsuario ?? (req as any).session?.usuario?.id ?? (req as any).session?.usuarioId;
    return raw && Number(raw) > 0 ? Number(raw) : null;
  }

  // 1. Listar estoque e alertas
  async listar(req: Request, res: Response): Promise<void> {
    try {
      const msg = req.query.msg ? String(req.query.msg) : null;
      const erro = req.query.erro ? String(req.query.erro) : null;

      const { produtos, produtosAlerta, categorias } = await estoqueService.listar();

      res.render('estoque/listar', {
        titulo: 'Controle de Estoque',
        moduloAtual: 'estoque',
        produtos,
        produtosAlerta,
        categorias,
        msg,
        erro
      });
    } catch (error) {
      console.error('Erro ao listar estoque:', error);
      res.status(500).send('Erro interno ao carregar o estoque.');
    }
  }

  // 2. Cadastrar novo produto
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const { nome, categoria_id, preco, quantidade_estoque, estoque_minimo, descricao } = req.body;

      if (!nome || !categoria_id || preco === undefined) {
        return res.redirect('/estoque?erro=Preencha todos os campos obrigatórios.');
      }

      await estoqueService.criar({
        categoria_id: Number(categoria_id),
        nome,
        descricao,
        preco: Math.max(0, parseFloat(String(preco).replace(',', '.')) || 0),
        controla_estoque: req.body.controla_estoque === '1' || req.body.controla_estoque === 'on' ? 1 : 0,
        quantidade_estoque: Math.max(0, parseInt(quantidade_estoque, 10) || 0),
        estoque_minimo: Math.max(0, parseInt(estoque_minimo, 10) || 0),
        usuarioId: this.extrairUsuarioId(req)
      });

      res.redirect('/estoque?msg=Produto cadastrado com sucesso no estoque!');
    } catch (error: any) {
      console.error('Erro ao cadastrar produto:', error);
      res.redirect(`/estoque?erro=${encodeURIComponent(error.message || 'Erro interno ao cadastrar produto no estoque.')}`);
    }
  }

  // 3. Atualizar produto
  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const { nome, categoria_id, preco, estoque_minimo, descricao } = req.body;

      if (!nome || !categoria_id || preco === undefined) {
        return res.redirect('/estoque?erro=Preencha os campos obrigatórios na edição.');
      }

      await estoqueService.atualizar(id, {
        categoria_id: Number(categoria_id),
        nome,
        descricao,
        preco: Math.max(0, parseFloat(String(preco).replace(',', '.')) || 0),
        controla_estoque: req.body.controla_estoque === '1' || req.body.controla_estoque === 'on' ? 1 : 0,
        estoque_minimo: Math.max(0, parseInt(estoque_minimo, 10) || 0)
      });

      res.redirect('/estoque?msg=Produto atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      res.redirect(`/estoque?erro=${encodeURIComponent(error.message || 'Erro interno ao atualizar produto.')}`);
    }
  }

  // 4. Lançamento rápido de Entrada / Saída / Perda / Ajuste manual
  async movimentar(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const { tipo_movimentacao, quantidade, motivo } = req.body;

      await estoqueService.movimentar(id, {
        tipo_movimentacao,
        quantidade: Math.max(0, parseInt(quantidade, 10) || 0),
        motivo,
        usuarioId: this.extrairUsuarioId(req)
      });

      res.redirect('/estoque?msg=Movimentação de estoque registrada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao movimentar estoque:', error);
      res.redirect(`/estoque?erro=${encodeURIComponent(error.message || 'Erro interno ao movimentar estoque.')}`);
    }
  }

  // 5. Excluir produto com trava rígida
  async excluir(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);

      await estoqueService.excluir(id);

      res.redirect('/estoque?msg=Produto removido do estoque com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir produto:', error);
      res.redirect(`/estoque?erro=${encodeURIComponent(error.message || 'Erro interno ao excluir produto.')}`);
    }
  }
}

export const estoqueController = new EstoqueController();
export default estoqueController;