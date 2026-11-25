import { Controller, Get, Post, Req, Res, Param, Body, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { CaixaService } from './caixa.service';
import {
  AbrirCaixaDto,
  FecharCaixaDto,
  AdicionarItemCheckoutDto,
  ProcessarPagamentoDto,
  VendaRapidaDto,
} from './dtos/caixa.dto';

@Controller('caixa')
export class CaixaController {
  constructor(
    @Inject(CaixaService)
    private readonly caixaService: CaixaService,
  ) {
    this.index = this.index.bind(this);
    this.abrirCaixa = this.abrirCaixa.bind(this);
    this.fecharCaixa = this.fecharCaixa.bind(this);
    this.adicionarItemCheckout = this.adicionarItemCheckout.bind(this);
    this.processarPagamento = this.processarPagamento.bind(this);
    this.vendaRapida = this.vendaRapida.bind(this);
  }

  private getService(): CaixaService {
    return this.caixaService || new CaixaService();
  }

  @Get()
  async index(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const service = this.getService();
      const caixaAberto = await service.obterCaixaAberto();
      const taxaServicoPercentual = service.obterTaxaServicoPadrao();

      let resumoBruto: any = null;
      let comandasAguardando: any[] = [];
      let produtosCheckout: any[] = [];
      let detalheRetorno: any = null;

      if (caixaAberto) {
        resumoBruto = await service.obterResumoTurno(
          caixaAberto.id,
          Number(caixaAberto.valor_inicial) || 0,
        );
        comandasAguardando = await service.listarComandasAguardando(taxaServicoPercentual);
        produtosCheckout = await service.listarProdutosCheckout();

        const paramId = req.query.comanda_id ?? req.query.comanda;
        let comandaIdParam = paramId ? Number(paramId) : null;

        if (!comandaIdParam && comandasAguardando.length > 0) {
          comandaIdParam = Number(comandasAguardando[0].id);
        }

        if (comandaIdParam) {
          detalheRetorno = await service.obterDetalhesComanda(
            comandaIdParam,
            taxaServicoPercentual,
          );
        }
      }

      const comandaSelecionada =
        detalheRetorno?.comandaSelecionada ||
        detalheRetorno?.comanda ||
        (detalheRetorno?.id ? detalheRetorno : null);

      const itensComanda =
        detalheRetorno?.itensComanda ||
        detalheRetorno?.itens ||
        comandaSelecionada?.itens ||
        [];

      const pagamentosRealizados =
        detalheRetorno?.pagamentosRealizados ||
        detalheRetorno?.pagamentos ||
        comandaSelecionada?.pagamentos ||
        [];

      const resumoDados = resumoBruto?.resumo || resumoBruto || {};
      const totalVendasNum = Number(resumoDados.totalVendas ?? resumoDados.total_vendas ?? 0);
      const totalTaxasNum = Number(resumoDados.totalTaxas ?? resumoDados.total_taxas ?? 0);
      const saldoGavetaNum = Number(
        resumoDados.saldoGavetaEsperado ??
        resumoDados.totalDinheiro ??
        caixaAberto?.valor_inicial ??
        0,
      );

      const resumoTurno = {
        totalVendas: totalVendasNum,
        totalTaxas: totalTaxasNum,
        saldoGavetaEsperado: saldoGavetaNum,
        ...resumoDados,
      };

      const usuarioIdLogado = session.usuario.id;
      const ehDonoDoCaixa = caixaAberto
        ? Number(caixaAberto.usuario_id) === Number(usuarioIdLogado) || session.usuario.perfil_id === 1
        : false;
      const podeEncerrar = ehDonoDoCaixa || session.usuario.perfil_id === 1;

      if (comandaSelecionada) {
        comandaSelecionada.desconto = Number(comandaSelecionada.desconto) || 0;
        comandaSelecionada.subtotal = Number(comandaSelecionada.subtotal) || 0;
        comandaSelecionada.total_pago = Number(comandaSelecionada.total_pago) || 0;
        comandaSelecionada.taxa_calculada = Number(comandaSelecionada.taxa_calculada) || 0;
        comandaSelecionada.saldo_restante = Number(comandaSelecionada.saldo_restante) || 0;
      }

      res.render('caixa/painel', {
        titulo: 'Frente de Caixa',
        moduloAtual: 'caixa',
        usuario: session.usuario,
        caixaAberto,
        caixaAtual: caixaAberto,
        ehDonoDoCaixa,
        podeEncerrar,
        nomeOperadorAtual: caixaAberto?.operador_nome || caixaAberto?.usuario_nome || session.usuario.nome || 'Operador',
        taxaServicoPadrao: taxaServicoPercentual,
        taxaInicial: comandaSelecionada?.taxa_calculada || 0,
        resumoTurno,
        comandasAguardando,
        comandaSelecionada,
        itensComanda,
        pagamentosRealizados,
        produtosCheckout,
        saldoRestanteInicial: comandaSelecionada?.saldo_restante ?? 0,
        funcionariosTurno: resumoBruto?.funcionariosTurno || [],
        garconsDoTurno: resumoBruto?.garconsDoTurno || [],
        subtotalNum: comandaSelecionada?.subtotal || 0,
        totalPagoNum: comandaSelecionada?.total_pago || 0,
        msg: req.query.msg || null,
        erro: req.query.erro || null,
      });
    } catch (error) {
      console.error('Erro ao carregar frente de caixa:', error);
      res.status(500).send('Erro interno ao carregar a frente de caixa.');
    }
  }

  @Post('abrir')
  async abrirCaixa(
    @Body() dto: AbrirCaixaDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      const usuarioId = session?.usuario?.id || 1;
      const valorInicial = Math.max(0, Number(dto.valor_inicial) || 0);

      await this.getService().abrirCaixa(usuarioId, valorInicial);
      res.redirect('/caixa?msg=' + encodeURIComponent('Caixa aberto com sucesso'));
    } catch (error: any) {
      console.error('Erro ao abrir caixa:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao abrir caixa');
      res.redirect(`/caixa?erro=${mensagem}`);
    }
  }

  @Post(':id/fechar')
  async fecharCaixa(
    @Param('id') id: string,
    @Body() dto: FecharCaixaDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const caixaId = Number(id);
      const valorFinal = Number(dto.valor_final ?? dto.saldo_conferido ?? 0);
      const totalTaxaTurno = Number(dto.total_taxa_turno ?? 0);

      await this.getService().fecharCaixa({
        caixaId,
        valorFinal,
        modalidadeRateio: dto.modalidade_rateio || 'POR_GARCOM',
        totalTaxaTurno,
        funcionariosRateio: dto.funcionarios_rateio || [],
      });

      res.redirect('/caixa?msg=' + encodeURIComponent('Caixa fechado com sucesso'));
    } catch (error: any) {
      console.error('Erro ao fechar caixa:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao fechar caixa');
      res.redirect(`/caixa?erro=${mensagem}`);
    }
  }

  @Post('comanda/:id/adicionar-item')
  async adicionarItemCheckout(
    @Param('id') id: string,
    @Body() dto: AdicionarItemCheckoutDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      const session = (req as any).session;
      const usuarioId = session?.usuario?.id || 1;

      await this.getService().adicionarItemCheckout({
        comandaId,
        produtoId: Number(dto.produto_id),
        quantidade: Number(dto.quantidade) || 1,
        usuarioId,
      });

      res.redirect(`/caixa?comanda_id=${comandaId}&msg=` + encodeURIComponent('Item adicionado ao checkout'));
    } catch (error: any) {
      console.error('Erro ao adicionar item no checkout:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao adicionar item');
      res.redirect(`/caixa?comanda_id=${comandaId}&erro=${mensagem}`);
    }
  }

  @Post('comanda/:id/pagar')
  async processarPagamento(
    @Param('id') id: string,
    @Body() dto: ProcessarPagamentoDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const comandaId = Number(id);
    try {
      const service = this.getService();
      const caixaAberto = await service.obterCaixaAberto();
      if (!caixaAberto) {
        return res.redirect(`/caixa?comanda_id=${comandaId}&erro=` + encodeURIComponent('Nenhum caixa aberto no momento'));
      }

      const aplicarTaxa = dto.aplicar_taxa === 'on' || dto.aplicar_taxa === 'true' || dto.aplicar_taxa === true || dto.aplicar_taxa === '1';
      const valorAbater = Number(dto.valor_abater ?? dto.valor_pago ?? 0);
      const dinheiroEntregue = Number(dto.dinheiro_entregue ?? valorAbater);
      const desconto = Number(dto.desconto ?? 0);
      const taxaPercentual = service.obterTaxaServicoPadrao();

      const resultado = await service.processarPagamento({
        comandaId,
        caixaId: caixaAberto.id,
        formaPagamento: dto.forma_pagamento,
        aplicarTaxa,
        taxaPercentual,
        desconto,
        valorAbater,
        dinheiroEntregue,
      });

      if (resultado?.quitou) {
        res.redirect('/caixa?msg=' + encodeURIComponent('Comanda quitada com sucesso e mesa liberada'));
      } else {
        res.redirect(`/caixa?comanda_id=${comandaId}&msg=` + encodeURIComponent('Pagamento parcial registrado'));
      }
    } catch (error: any) {
      console.error('Erro ao processar pagamento:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao processar pagamento');
      res.redirect(`/caixa?comanda_id=${comandaId}&erro=${mensagem}`);
    }
  }

  @Post('venda-rapida')
  async vendaRapida(
    @Body() dto: VendaRapidaDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      const usuarioId = session?.usuario?.id || 1;
      const caixaAberto = await this.getService().obterCaixaAberto();

      await this.getService().processarVendaRapida({
        caixaId: caixaAberto?.id,
        usuarioId,
        produtoId: dto.produto_id ? Number(dto.produto_id) : undefined,
        quantidade: dto.quantidade ? Number(dto.quantidade) : undefined,
        itens: dto.itens || [],
        formaPagamento: dto.forma_pagamento || 'DINHEIRO',
        desconto: dto.desconto ? Number(dto.desconto) : 0,
        valorRecebido: dto.valor_recebido ? Number(dto.valor_recebido) : undefined,
      });

      res.redirect('/caixa?msg=' + encodeURIComponent('Venda rápida concluída com sucesso'));
    } catch (error: any) {
      console.error('Erro na venda rápida:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao realizar venda rápida');
      res.redirect(`/caixa?erro=${mensagem}`);
    }
  }
}