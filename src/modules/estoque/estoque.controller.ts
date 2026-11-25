import { Controller, Get, Post, Req, Res, Param, Body, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { EstoqueService } from './estoque.service';
import {
  CriarItemEstoqueDto,
  MovimentarEstoqueDto,
  AtualizarItemEstoqueDto,
} from './dtos/estoque.dto';

@Controller('estoque')
export class EstoqueController {
  constructor(
    @Inject(EstoqueService)
    private readonly estoqueService: EstoqueService,
  ) {
    this.index = this.index.bind(this);
    this.criar = this.criar.bind(this);
    this.movimentar = this.movimentar.bind(this);
    this.atualizarComEditar = this.atualizarComEditar.bind(this);
    this.atualizarDireto = this.atualizarDireto.bind(this);
    this.excluir = this.excluir.bind(this);
  }

  private getService(): EstoqueService {
    return this.estoqueService || new EstoqueService();
  }

  @Get()
  async index(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const dados = await this.getService().listar();

      res.render('estoque/listar', {
        titulo: 'Controle de Estoque',
        moduloAtual: 'estoque',
        usuario: session.usuario,
        msg: req.query.msg || null,
        erro: req.query.erro || null,
        ...(dados && typeof dados === 'object' ? dados : { itens: dados }),
      });
    } catch (error) {
      console.error('Erro ao listar estoque:', error);
      res.status(500).send('Erro interno ao carregar o estoque.');
    }
  }

  @Post('novo')
  async criar(
    @Body() dto: CriarItemEstoqueDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      const body = req.body || {};

      if (!dto.nome?.trim()) {
        return res.redirect('/estoque?erro=' + encodeURIComponent('O nome do item é obrigatório'));
      }

      const controlaEstoque =
        body.controla_estoque !== undefined
          ? body.controla_estoque === '1' || body.controla_estoque === 'on' || body.controla_estoque === 1 || body.controla_estoque === true
            ? 1
            : 0
          : 1;

      await this.getService().criar({
        nome: dto.nome.trim(),
        categoria_id: Number(dto.categoria_id) || 1,
        preco: Number(dto.preco) || 0,
        controla_estoque: controlaEstoque,
        quantidade_estoque: Number(dto.quantidade_estoque) || 0,
        estoque_minimo: Number(dto.estoque_minimo) || 0,
        descricao: dto.descricao?.trim() || null,
        usuarioId: session?.usuario?.id || 1,
      });

      res.redirect('/estoque?msg=' + encodeURIComponent('Item cadastrado no estoque com sucesso'));
    } catch (error: any) {
      console.error('Erro ao cadastrar item no estoque:', error);
      const msg = encodeURIComponent(error.message || 'Erro ao cadastrar item no estoque');
      res.redirect(`/estoque?erro=${msg}`);
    }
  }

  @Post(':id/movimentar')
  async movimentar(
    @Param('id') id: string,
    @Body() dto: MovimentarEstoqueDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      const body = req.body || {};
      const usuarioId = session?.usuario?.id || 1;
      const idNum = Number(id);
      const qtd = Number(dto.quantidade ?? body.quantidade);
      const tipoMov = (body.tipo_movimentacao || dto.tipo || body.tipo || '').trim().toUpperCase();

      if (isNaN(qtd) || (tipoMov !== 'AJUSTE' && qtd <= 0) || (tipoMov === 'AJUSTE' && qtd < 0)) {
        return res.redirect('/estoque?erro=' + encodeURIComponent('Informe uma quantidade válida'));
      }

      await this.getService().movimentar(idNum, {
        tipo_movimentacao: tipoMov,
        quantidade: qtd,
        motivo: (dto.motivo || body.motivo)?.trim() || 'Movimentação manual',
        usuarioId,
      });

      res.redirect('/estoque?msg=' + encodeURIComponent('Estoque atualizado com sucesso'));
    } catch (error: any) {
      console.error('Erro ao movimentar estoque:', error);
      const mensagemErro = encodeURIComponent(error.message || 'Erro ao registrar movimentação');
      res.redirect(`/estoque?erro=${mensagemErro}`);
    }
  }

  @Post(':id/editar')
  async atualizarComEditar(
    @Param('id') id: string,
    @Body() dto: AtualizarItemEstoqueDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.processarAtualizacao(id, dto, req, res);
  }

  @Post(':id')
  async atualizarDireto(
    @Param('id') id: string,
    @Body() dto: AtualizarItemEstoqueDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.processarAtualizacao(id, dto, req, res);
  }

  private async processarAtualizacao(
    id: string,
    dto: AtualizarItemEstoqueDto,
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const body = req.body || {};
      const idNum = Number(id);

      const controlaEstoque =
        body.controla_estoque !== undefined
          ? body.controla_estoque === '1' || body.controla_estoque === 'on' || body.controla_estoque === 1 || body.controla_estoque === true
            ? 1
            : 0
          : 1;

      await this.getService().atualizar(idNum, {
        nome: (dto.nome || body.nome || '').trim(),
        categoria_id: Number(dto.categoria_id || body.categoria_id) || 1,
        preco: Number(dto.preco ?? body.preco) || 0,
        controla_estoque: controlaEstoque,
        estoque_minimo: dto.estoque_minimo !== undefined ? Number(dto.estoque_minimo) : undefined,
        descricao: (dto.descricao ?? body.descricao)?.trim() || null,
      });

      res.redirect('/estoque?msg=' + encodeURIComponent('Item atualizado com sucesso'));
    } catch (error: any) {
      console.error('Erro ao atualizar item do estoque:', error);
      const msg = encodeURIComponent(error.message || 'Erro ao atualizar item');
      res.redirect(`/estoque?erro=${msg}`);
    }
  }

  @Post(':id/excluir')
  async excluir(@Param('id') id: string, @Res() res: Response): Promise<void> {
    try {
      await this.getService().excluir(Number(id));
      res.redirect('/estoque?msg=' + encodeURIComponent('Item removido do estoque'));
    } catch (error: any) {
      console.error('Erro ao excluir item do estoque:', error);
      const msg = encodeURIComponent(error.message || 'Erro ao excluir item');
      res.redirect(`/estoque?erro=${msg}`);
    }
  }
}