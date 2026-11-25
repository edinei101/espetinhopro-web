import { Controller, Get, Post, Req, Res, Param, Body, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { CardapioService } from './cardapio.service';
import { CriarProdutoDto, AtualizarProdutoDto } from './dtos/produto.dto';

@Controller('cardapio')
export class CardapioController {
  constructor(
    @Inject(CardapioService)
    private readonly cardapioService: CardapioService,
  ) {
    this.index = this.index.bind(this);
    this.criar = this.criar.bind(this);
    this.atualizarComEditar = this.atualizarComEditar.bind(this);
    this.atualizarDireto = this.atualizarDireto.bind(this);
    this.excluir = this.excluir.bind(this);
  }

  private getService(): CardapioService {
    return this.cardapioService || new CardapioService();
  }

  private parseCheckbox(val: any): number {
    return val === 'on' || val === '1' || val === 1 || val === true || val === 'true' ? 1 : 0;
  }

  @Get()
  async index(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const categoriaId = req.query.categoria ? Number(req.query.categoria) : 1;
      const dados = await this.getService().listarPorCategoria(categoriaId);

      res.render('cardapio/listar', {
        titulo: 'Gestão de Cardápio',
        moduloAtual: 'cardapio',
        usuario: session.usuario,
        categoriaAtiva: categoriaId,
        categoriaSelecionada: categoriaId,
        msg: req.query.msg || null,
        erro: req.query.erro || null,
        ...(dados && typeof dados === 'object' ? dados : { produtos: dados }),
      });
    } catch (error) {
      console.error('Erro ao listar cardápio:', error);
      res.status(500).send('Erro interno ao carregar o cardápio.');
    }
  }

  @Post('novo')
  async criar(
    @Body() dto: CriarProdutoDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const body = req.body || {};
    const categoriaId = Number(body.categoria_id ?? body.categoriaId ?? dto.categoria_id) || 1;
    try {
      const nome = (body.nome ?? dto.nome ?? '').trim();
      const preco = Number(body.preco ?? dto.preco);

      if (!nome || isNaN(preco)) {
        return res.redirect(
          `/cardapio?categoria=${categoriaId}&erro=` +
            encodeURIComponent('Nome e preço são obrigatórios'),
        );
      }

      const requerPontoCarne = this.parseCheckbox(
        body.requer_ponto_carne ?? body.permite_ponto_carne ?? dto.permite_ponto_carne,
      );
      const controlaEstoque = this.parseCheckbox(body.controla_estoque);
      const quantidadeEstoque = Number(body.quantidade_estoque) || 0;

      await this.getService().criarItem({
        categoriaId,
        nome,
        descricao: (body.descricao ?? dto.descricao)?.trim() || null,
        preco,
        requerPontoCarne,
        controlaEstoque,
        quantidadeEstoque,
        acompanhamentos: body.acompanhamentos,
      });

      res.redirect(
        `/cardapio?categoria=${categoriaId}&msg=` +
          encodeURIComponent('Produto criado com sucesso'),
      );
    } catch (error: any) {
      console.error('Erro ao criar produto:', error);
      const msg = encodeURIComponent(error.message || 'Erro ao salvar produto');
      res.redirect(`/cardapio?categoria=${categoriaId}&erro=${msg}`);
    }
  }

  @Post(':id/editar')
  async atualizarComEditar(
    @Param('id') id: string,
    @Body() dto: AtualizarProdutoDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.processarAtualizacao(id, dto, req, res);
  }

  @Post(':id')
  async atualizarDireto(
    @Param('id') id: string,
    @Body() dto: AtualizarProdutoDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.processarAtualizacao(id, dto, req, res);
  }

  private async processarAtualizacao(
    id: string,
    dto: AtualizarProdutoDto,
    req: Request,
    res: Response,
  ): Promise<void> {
    const body = req.body || {};
    const categoriaId = Number(body.categoria_id ?? body.categoriaId ?? dto.categoria_id) || 1;
    try {
      const produtoId = Number(id);
      const requerPontoCarne = this.parseCheckbox(
        body.requer_ponto_carne ?? body.permite_ponto_carne ?? dto.permite_ponto_carne,
      );
      const controlaEstoque = this.parseCheckbox(body.controla_estoque);
      const quantidadeEstoque = Number(body.quantidade_estoque) || 0;

      await this.getService().atualizarItem(produtoId, {
        categoriaId,
        nome: (body.nome ?? dto.nome ?? '').trim(),
        descricao: (body.descricao ?? dto.descricao)?.trim() || null,
        preco: Number(body.preco ?? dto.preco) || 0,
        requerPontoCarne,
        controlaEstoque,
        quantidadeEstoque,
        acompanhamentos: body.acompanhamentos,
      });

      res.redirect(
        `/cardapio?categoria=${categoriaId}&msg=` +
          encodeURIComponent('Produto atualizado com sucesso'),
      );
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      const msg = encodeURIComponent(error.message || 'Erro ao atualizar produto');
      res.redirect(`/cardapio?categoria=${categoriaId}&erro=${msg}`);
    }
  }

  @Post(':id/excluir')
  async excluir(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const categoriaId = req.query.categoria ? Number(req.query.categoria) : 1;
    try {
      await this.getService().excluirItem(Number(id));
      res.redirect(
        `/cardapio?categoria=${categoriaId}&msg=` +
          encodeURIComponent('Produto removido com sucesso'),
      );
    } catch (error: any) {
      console.error('Erro ao excluir produto:', error);
      const msg = encodeURIComponent(error.message || 'Erro ao excluir produto');
      res.redirect(`/cardapio?categoria=${categoriaId}&erro=${msg}`);
    }
  }
}