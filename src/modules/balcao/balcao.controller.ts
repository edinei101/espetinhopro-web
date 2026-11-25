import { Controller, Get, Post, Param, Body, Req, Res, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { BalcaoService } from './balcao.service';
import {
  AbrirComandaBalcaoDto,
  AdicionarItemBalcaoDto,
} from './dtos/balcao.dto';

function obterAtendenteId(req: Request): number {
  const session = (req as any).session;
  const id = session?.usuario?.id ?? session?.idUsuario;
  return id && Number(id) > 0 ? Number(id) : 1;
}

@Controller('balcao')
export class BalcaoController {
  constructor(
    @Inject(BalcaoService)
    private readonly balcaoService: BalcaoService,
  ) {
    this.listarComandas = this.listarComandas.bind(this);
    this.abrirComanda = this.abrirComanda.bind(this);
    this.exibirComanda = this.exibirComanda.bind(this);
    this.adicionarItem = this.adicionarItem.bind(this);
    this.removerItem = this.removerItem.bind(this);
    this.enviarProducao = this.enviarProducao.bind(this);
    this.cancelarComanda = this.cancelarComanda.bind(this);
    this.fecharConta = this.fecharConta.bind(this);
  }

  private getService(): BalcaoService {
    return this.balcaoService || new BalcaoService();
  }

  @Get()
  async listarComandas(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const comandas = await this.getService().listarComandas();

      res.render('balcao/painel', {
        titulo: 'Balcão / Rápido',
        moduloAtual: 'balcao',
        usuario: session.usuario,
        comandas,
        msg: req.query.msg || null,
        erro: req.query.erro || null,
      });
    } catch (error) {
      console.error('Erro ao listar balcão:', error);
      res.status(500).send('Erro interno ao listar comandas do balcão.');
    }
  }

  @Post(['abrir', 'nova'])
  async abrirComanda(
    @Body() dto: AbrirComandaBalcaoDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const body = req.body || {};
      const nomeCliente =
        (dto.nome_cliente ?? dto.nomeCliente ?? body.nome_cliente ?? body.nomeCliente)?.trim() ||
        'Cliente Balcão';
      const atendenteId = obterAtendenteId(req);

      const novaComandaId = await this.getService().abrirComanda(nomeCliente, atendenteId);
      res.redirect(`/balcao/comanda/${novaComandaId}`);
    } catch (error) {
      console.error('Erro ao abrir comanda de balcão:', error);
      res.status(500).send('Erro ao abrir nova comanda.');
    }
  }

  @Get('comanda/:id')
  async exibirComanda(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const comandaId = Number(id);
      const detalhes = await this.getService().obterDetalhesComanda(comandaId);

      if (!detalhes) {
        return res.redirect('/balcao');
      }

      res.render('balcao/detalhes', {
        titulo: `Comanda Balcão #${comandaId}`,
        moduloAtual: 'balcao',
        usuario: session.usuario,
        ...detalhes,
        msg: req.query.msg || null,
        erro: req.query.erro || null,
      });
    } catch (error) {
      console.error('Erro ao exibir comanda balcão:', error);
      res.status(500).send('Erro ao carregar detalhes da comanda.');
    }
  }

  @Post(['comanda/:id/adicionar', 'comanda/:id/itens', 'comanda/:id/item'])
  async adicionarItem(
    @Param('id') id: string,
    @Body() dto: AdicionarItemBalcaoDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      const body = req.body || {};
      const produtoId = Number(dto.produto_id ?? dto.produtoId ?? body.produto_id ?? body.produtoId);
      const quantidade = Math.max(1, Number(dto.quantidade ?? body.quantidade) || 1);
      const pontoBruto = dto.ponto_carne ?? dto.pontoCarne ?? body.ponto_carne ?? body.pontoCarne;
      const pontoCarne = pontoBruto ? String(pontoBruto).trim() : null;
      const obsBruta = dto.observacao ?? body.observacao;
      const observacao = obsBruta ? String(obsBruta).trim() : null;
      const usuarioId = obterAtendenteId(req);

      await this.getService().adicionarItem({
        comandaId,
        produtoId,
        quantidade,
        pontoCarne,
        observacao,
        usuarioId,
      });

      res.redirect(`/balcao/comanda/${comandaId}`);
    } catch (error) {
      console.error('Erro ao adicionar item no balcão:', error);
      res.redirect(`/balcao/comanda/${comandaId}`);
    }
  }

  @Post(['comanda/:id/remover/:itemId', 'comanda/:id/itens/:itemId/remover', 'comanda/:id/item/:itemId/cancelar'])
  async removerItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      await this.getService().removerItem(comandaId, Number(itemId));
      res.redirect(`/balcao/comanda/${comandaId}`);
    } catch (error) {
      console.error('Erro ao remover item do balcão:', error);
      res.redirect(`/balcao/comanda/${comandaId}`);
    }
  }

  @Post(['comanda/:id/enviar-producao', 'comanda/:id/producao'])
  async enviarProducao(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      await this.getService().enviarProducao(comandaId);
      res.redirect(`/balcao/comanda/${comandaId}`);
    } catch (error) {
      console.error('Erro ao enviar balcão para produção:', error);
      res.redirect(`/balcao/comanda/${comandaId}`);
    }
  }

  @Post('comanda/:id/cancelar')
  async cancelarComanda(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      await this.getService().cancelarComanda(comandaId);
      res.redirect('/balcao');
    } catch (error) {
      console.error('Erro ao cancelar comanda de balcão:', error);
      res.redirect(`/balcao/comanda/${comandaId}`);
    }
  }

  @Post(['comanda/:id/fechar-conta', 'comanda/:id/fechamento', 'comanda/:id/fechar'])
  async fecharConta(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      await this.getService().solicitarFechamento(comandaId);
      res.redirect('/balcao');
    } catch (error: any) {
      console.error('Erro ao fechar balcão:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao fechar conta');
      res.redirect(`/balcao/comanda/${comandaId}?erro=${mensagem}`);
    }
  }
}