import { Controller, Get, Post, Req, Res, Param, Body, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { MesasService } from './mesas.service';
import {
  AbrirMesaDto,
  AdicionarItemMesaDto,
  SalvarMesaDto,
} from './dtos/mesas.dto';

@Controller()
export class MesasController {
  constructor(
    @Inject(MesasService)
    private readonly mesasService: MesasService,
  ) {
    this.index = this.index.bind(this);
    this.cadastrarMesasView = this.cadastrarMesasView.bind(this);
    this.criarMesa = this.criarMesa.bind(this);
    this.excluirMesa = this.excluirMesa.bind(this);
    this.abrir = this.abrir.bind(this);
    this.detalhesComanda = this.detalhesComanda.bind(this);
    this.adicionarItem = this.adicionarItem.bind(this);
    this.enviarProducao = this.enviarProducao.bind(this);
    this.cancelarItem = this.cancelarItem.bind(this);
    this.cancelarComanda = this.cancelarComanda.bind(this);
    this.fecharConta = this.fecharConta.bind(this);
  }

  private getService(): MesasService {
    return this.mesasService || new MesasService();
  }

  // 1. Painel Salão de Mesas
  @Get('mesas')
  async index(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const mesas = await this.getService().listarPainel();

      res.render('mesas/painel', {
        titulo: 'Salão de Mesas',
        moduloAtual: 'mesas',
        usuario: session.usuario,
        mesas: mesas || [],
        msg: req.query.msg || null,
        erro: req.query.erro || null,
      });
    } catch (error) {
      console.error('Erro ao listar mesas:', error);
      res.status(500).send('Erro interno ao listar o salão de mesas.');
    }
  }

  // 2. Tela de Cadastro de Mesas
  @Get(['cadastrar-mesas', 'mesas/cadastrar'])
  async cadastrarMesasView(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const dados = await this.getService().listarTodas();

      const listaMesas = Array.isArray(dados)
        ? dados
        : (dados as any)?.mesas || [];

      res.render('mesas/cadastrarMesa', {
        titulo: 'Cadastrar Mesas',
        moduloAtual: 'mesas',
        usuario: session.usuario,
        mesas: listaMesas,
        msg: req.query.msg || null,
        erro: req.query.erro || null,
      });
    } catch (error) {
      console.error('Erro ao carregar cadastro de mesas:', error);
      res.status(500).send('Erro interno ao carregar cadastro de mesas.');
    }
  }

  @Post(['cadastrar-mesas/nova', 'mesas/nova'])
  async criarMesa(
    @Body() dto: SalvarMesaDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const body = req.body || {};
      const num = Number(dto.numero ?? body.numero);
      const nomeIdentificador = (body.nome_identificador ?? body.nomeIdentificador ?? '').trim() || null;

      if (!num || num <= 0) {
        return res.redirect('/cadastrar-mesas?erro=' + encodeURIComponent('Informe um número de mesa válido'));
      }

      await this.getService().criarMesa({ numero: num, nomeIdentificador });
      res.redirect('/cadastrar-mesas?msg=' + encodeURIComponent('Mesa cadastrada com sucesso'));
    } catch (error: any) {
      console.error('Erro ao cadastrar mesa:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao cadastrar mesa');
      res.redirect(`/cadastrar-mesas?erro=${mensagem}`);
    }
  }

  @Post(['cadastrar-mesas/:id/excluir', 'mesas/:id/excluir'])
  async excluirMesa(@Param('id') id: string, @Res() res: Response): Promise<void> {
    try {
      await this.getService().excluirMesa(Number(id));
      res.redirect('/cadastrar-mesas?msg=' + encodeURIComponent('Mesa excluída com sucesso'));
    } catch (error: any) {
      console.error('Erro ao excluir mesa:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao excluir mesa');
      res.redirect(`/cadastrar-mesas?erro=${mensagem}`);
    }
  }

  // 3. Abertura de Mesa
  @Post('mesas/abrir')
  async abrir(
    @Body() dto: AbrirMesaDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      const atendenteId = session?.usuario?.id || 1;
      const mesaId = Number(dto.mesa_id ?? dto.mesaId);
      const nomeCliente = (dto.nome_cliente ?? dto.nomeCliente)?.trim() || 'Cliente';

      if (!mesaId) {
        return res.redirect('/mesas?erro=' + encodeURIComponent('Selecione uma mesa válida'));
      }

      const comandaId = await this.getService().abrirComanda(mesaId, nomeCliente, atendenteId);
      res.redirect(`/mesas/comanda/${comandaId}`);
    } catch (error: any) {
      console.error('Erro ao abrir comanda de mesa:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao abrir mesa');
      res.redirect(`/mesas?erro=${mensagem}`);
    }
  }

  // 4. Detalhes da Comanda
  @Get(['mesas/comanda/:id', 'comanda/:id'])
  async detalhesComanda(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const comandaId = Number(id);
      const dados = await this.getService().obterDetalhesComanda(comandaId);

      if (!dados || !dados.comanda) {
        return res.redirect('/mesas?erro=' + encodeURIComponent('Comanda não encontrada.'));
      }

      res.render('mesas/detalhes', {
        titulo: `Comanda Mesa #${dados.comanda.mesa_numero || id}`,
        moduloAtual: 'mesas',
        usuario: session.usuario,
        ...dados,
        msg: req.query.msg || null,
        erro: req.query.erro || null,
      });
    } catch (error) {
      console.error('Erro ao carregar comanda da mesa:', error);
      res.status(500).send('Erro interno ao carregar detalhes da comanda.');
    }
  }

  // 5. Adicionar Item
  @Post(['mesas/comanda/:id/itens', 'mesas/comanda/:id/adicionar', 'mesas/comanda/:id/item'])
  async adicionarItem(
    @Param('id') id: string,
    @Body() dto: AdicionarItemMesaDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      const session = (req as any).session;
      const usuarioId = session?.usuario?.id || 1;

      await this.getService().adicionarItem({
        comandaId,
        produtoId: Number(dto.produto_id ?? dto.produtoId),
        quantidade: Math.max(1, Number(dto.quantidade) || 1),
        observacao: dto.observacao?.trim() || null,
        pontoCarne: dto.ponto_carne ?? dto.pontoCarne ?? null,
        usuarioId,
      });

      res.redirect(`/mesas/comanda/${comandaId}?msg=` + encodeURIComponent('Item adicionado'));
    } catch (error: any) {
      console.error('Erro ao adicionar item na mesa:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao adicionar item');
      res.redirect(`/mesas/comanda/${comandaId}?erro=${mensagem}`);
    }
  }

  // 6. Enviar para Cozinha/Bar
  @Post(['mesas/comanda/:id/enviar-producao', 'mesas/comanda/:id/producao'])
  async enviarProducao(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      await this.getService().enviarProducao(comandaId);
      res.redirect(`/mesas/comanda/${comandaId}?msg=` + encodeURIComponent('Pedidos enviados para produção'));
    } catch (error: any) {
      console.error('Erro ao enviar para produção:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao enviar para produção');
      res.redirect(`/mesas/comanda/${comandaId}?erro=${mensagem}`);
    }
  }

  // 7. Cancelar/Remover Item
  @Post(['mesas/comanda/:id/item/:itemId/cancelar', 'mesas/comanda/:id/itens/:itemId/cancelar', 'mesas/comanda/:id/remover/:itemId'])
  async cancelarItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      await this.getService().removerItem(comandaId, Number(itemId));
      res.redirect(`/mesas/comanda/${comandaId}?msg=` + encodeURIComponent('Item removido'));
    } catch (error: any) {
      console.error('Erro ao cancelar item:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao cancelar item');
      res.redirect(`/mesas/comanda/${comandaId}?erro=${mensagem}`);
    }
  }

  // 8. Cancelar Comanda Inteira
  @Post('mesas/comanda/:id/cancelar')
  async cancelarComanda(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.getService().cancelarComanda(Number(id));
      res.redirect('/mesas?msg=' + encodeURIComponent('Comanda cancelada com sucesso'));
    } catch (error: any) {
      console.error('Erro ao cancelar comanda:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao cancelar comanda');
      res.redirect(`/mesas/comanda/${id}?erro=${mensagem}`);
    }
  }

  // 9. Fechar Conta (Solicitar Fechamento)
  @Post(['mesas/comanda/:id/fechar-conta', 'mesas/comanda/:id/fechar'])
  async fecharConta(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.getService().solicitarFechamento(Number(id));
      res.redirect('/mesas?msg=' + encodeURIComponent('Conta fechada e enviada ao caixa'));
    } catch (error: any) {
      console.error('Erro ao fechar conta:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao solicitar fechamento');
      res.redirect(`/mesas/comanda/${id}?erro=${mensagem}`);
    }
  }
}