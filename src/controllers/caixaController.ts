import { Request, Response } from 'express';
import { caixaService } from '../services/caixaService';

function ehGerenteOuAdmin(req: Request): boolean {
  const usuarioLogado = (req as any).session?.usuario;
  const isAdmin = Boolean((req as any).session?.isAdmin || usuarioLogado?.isAdmin);
  const perfilNome = (usuarioLogado?.perfil_nome || '').toLowerCase();
  return isAdmin || perfilNome.includes('admin') || perfilNome.includes('gerente');
}

function obterUsuarioLogadoId(req: Request): number {
  return Number((req as any).session?.idUsuario ?? (req as any).session?.usuario?.id ?? 0);
}

class CaixaController {
  // 1. Exibir painel do Caixa com verificação de titularidade
  async exibirPainel(req: Request, res: Response): Promise<void> {
    try {
      const comandaIdParam = req.query.comanda_id ? Number(req.query.comanda_id) : null;
      const taxaServicoPadrao = Number(process.env.TAXA_SERVICO_PERCENTUAL) || 10;
      const idUsuarioLogado = obterUsuarioLogadoId(req);
      const isGerenteOuAdmin = ehGerenteOuAdmin(req);

      const caixaAtual = await caixaService.obterCaixaAberto();

      // Trava de segurança para caixas de outro operador
      if (caixaAtual) {
        const idDonoCaixa = Number(caixaAtual.usuario_id);
        const ehDonoDoCaixa = idUsuarioLogado === idDonoCaixa;

        if (!ehDonoDoCaixa && !isGerenteOuAdmin) {
          return res.render('caixa/painel', {
            titulo: 'Caixa Ocupado',
            moduloAtual: 'caixa',
            caixaAtual,
            caixaBloqueado: true,
            ehDonoDoCaixa: false,
            podeEncerrar: false,
            nomeOperadorAtual: caixaAtual.operador_nome || 'Outro Colaborador',
            comandasAguardando: [],
            comandaSelecionada: null,
            itensComanda: [],
            pagamentosRealizados: [],
            produtosCheckout: [],
            resumoTurno: null,
            garconsDoTurno: [],
            funcionariosTurno: [],
            taxaServicoPadrao
          });
        }
      }

      const idDonoCaixa = caixaAtual ? Number(caixaAtual.usuario_id) : idUsuarioLogado;
      const ehDonoDoCaixa = caixaAtual ? (idUsuarioLogado === idDonoCaixa) : true;
      const podeEncerrar = isGerenteOuAdmin || ehDonoDoCaixa;

      let resumoTurno = {
        totalVendas: 0,
        totalTaxas: 0,
        totalDinheiro: 0,
        totalPix: 0,
        totalCartao: 0,
        saldoGavetaEsperado: 0
      };
      let garconsDoTurno: any[] = [];
      let funcionariosTurno: any[] = [];

      if (caixaAtual) {
        const dadosTurno = await caixaService.obterResumoTurno(caixaAtual.id, Number(caixaAtual.valor_inicial) || 0);
        resumoTurno = dadosTurno.resumo;
        garconsDoTurno = dadosTurno.garconsDoTurno;
        funcionariosTurno = dadosTurno.funcionariosTurno;
      }

      const comandasAguardando = await caixaService.listarComandasAguardando(taxaServicoPadrao);
      const produtosCheckout = await caixaService.listarProdutosCheckout();

      let comandaSelecionada: any = null;
      let itensComanda: any[] = [];
      let pagamentosRealizados: any[] = [];

      const idParaBuscar = comandaIdParam || (comandasAguardando.length > 0 ? comandasAguardando[0].id : null);

      if (idParaBuscar) {
        const detalhes = await caixaService.obterDetalhesComanda(idParaBuscar, taxaServicoPadrao);
        if (detalhes) {
          comandaSelecionada = detalhes.comandaSelecionada;
          itensComanda = detalhes.itensComanda;
          pagamentosRealizados = detalhes.pagamentosRealizados;
        }
      }

      res.render('caixa/painel', {
        titulo: 'Frente de Caixa & Pagamentos',
        moduloAtual: 'caixa',
        caixaAtual,
        caixaBloqueado: false,
        ehDonoDoCaixa,
        podeEncerrar,
        nomeOperadorAtual: caixaAtual?.operador_nome || 'Caixa',
        resumoTurno,
        garconsDoTurno,
        funcionariosTurno,
        comandasAguardando,
        comandaSelecionada,
        itensComanda,
        pagamentosRealizados,
        produtosCheckout,
        taxaServicoPadrao
      });
    } catch (error) {
      console.error('Erro ao carregar módulo do caixa:', error);
      res.status(500).send('Erro interno ao carregar o caixa.');
    }
  }

  // 2. Abertura do Caixa
  async abrirCaixa(req: Request, res: Response): Promise<void> {
    try {
      const valorInicial = Math.max(0, Number(req.body.valor_inicial) || 0);
      const usuarioId = obterUsuarioLogadoId(req) || 1;

      await caixaService.abrirCaixa(usuarioId, valorInicial);
      res.redirect('/caixa');
    } catch (error: any) {
      console.error('Erro ao abrir caixa:', error);
      res.redirect(`/caixa?erro=${encodeURIComponent(error.message || 'Erro ao abrir caixa.')}`);
    }
  }

  // 3. Fechamento do Caixa
  async fecharCaixa(req: Request, res: Response): Promise<void> {
    try {
      const caixaId = Number(req.params.id);
      const idUsuarioLogado = obterUsuarioLogadoId(req);
      const isGerenteOuAdmin = ehGerenteOuAdmin(req);

      const caixaAtual = await caixaService.obterCaixaAberto();
      if (!caixaAtual || caixaAtual.id !== caixaId) {
        return res.redirect('/caixa');
      }

      if (idUsuarioLogado !== Number(caixaAtual.usuario_id) && !isGerenteOuAdmin) {
        return res.redirect('/caixa?erro=Você não tem permissão para fechar o caixa de outro operador.');
      }

      await caixaService.fecharCaixa({
        caixaId,
        valorFinal: Math.max(0, Number(req.body.valor_final) || 0),
        modalidadeRateio: req.body.modalidade_rateio,
        totalTaxaTurno: Math.max(0, Number(req.body.total_taxa_turno) || 0),
        funcionariosRateio: req.body.funcionarios_rateio
      });

      res.redirect('/caixa?msg=Caixa encerrado com sucesso!');
    } catch (error) {
      console.error('Erro ao fechar caixa e ratear gorjetas:', error);
      res.status(500).send('Erro ao fechar o caixa.');
    }
  }

  // 4. Adicionar doce diretamente à comanda no Caixa
  async adicionarItemCheckoutNaComanda(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      const caixaAtual = await caixaService.obterCaixaAberto();
      const idUsuarioLogado = obterUsuarioLogadoId(req);

      if (!caixaAtual || Number(caixaAtual.usuario_id) !== idUsuarioLogado) {
        return res.redirect(`/caixa?comanda_id=${comandaId}&erro=Apenas o titular deste caixa pode lançar itens.`);
      }

      await caixaService.adicionarItemCheckout({
        comandaId,
        produtoId: Number(req.body.produto_id),
        quantidade: Math.max(1, Number(req.body.quantidade) || 1),
        usuarioId: idUsuarioLogado || 1
      });

      res.redirect(`/caixa?comanda_id=${comandaId}`);
    } catch (error) {
      console.error('Erro ao adicionar doce na comanda pelo caixa:', error);
      res.redirect(`/caixa?comanda_id=${comandaId}`);
    }
  }

  // 5. Processar Pagamento
  async processarPagamento(req: Request, res: Response): Promise<void> {
    const comandaId = Number(req.params.id);
    try {
      const caixaAtual = await caixaService.obterCaixaAberto();
      const idUsuarioLogado = obterUsuarioLogadoId(req);

      if (!caixaAtual || Number(caixaAtual.usuario_id) !== idUsuarioLogado) {
        return res.redirect(`/caixa?comanda_id=${comandaId}&erro=Apenas o responsável pela gaveta pode registrar pagamentos.`);
      }

      const formaPagamento = req.body.forma_pagamento || 'DINHEIRO';
      const valorAbater = Math.max(0, Number(req.body.valor_abater) || 0);
      const dinheiroEntregue = formaPagamento === 'DINHEIRO'
        ? Math.max(0, Number(req.body.dinheiro_entregue) || valorAbater)
        : valorAbater;

      const resultado = await caixaService.processarPagamento({
        comandaId,
        caixaId: caixaAtual.id,
        formaPagamento,
        aplicarTaxa: req.body.aplicar_taxa === 'on',
        taxaPercentual: Number(process.env.TAXA_SERVICO_PERCENTUAL) || 10,
        desconto: Math.max(0, Number(req.body.desconto) || 0),
        valorAbater,
        dinheiroEntregue
      });

      if (resultado.quitou) {
        res.redirect('/caixa');
      } else {
        res.redirect(`/caixa?comanda_id=${comandaId}`);
      }
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      res.redirect(`/caixa?comanda_id=${comandaId}`);
    }
  }

  // 6. Venda Rápida avulsa
  async vendaRapida(req: Request, res: Response): Promise<void> {
    try {
      const caixaAtual = await caixaService.obterCaixaAberto();
      const idUsuarioLogado = obterUsuarioLogadoId(req);

      if (!caixaAtual || Number(caixaAtual.usuario_id) !== idUsuarioLogado) {
        return res.redirect('/caixa?erro=Apenas o responsável pela gaveta pode realizar vendas avulsas.');
      }

      await caixaService.processarVendaRapida({
        caixaId: caixaAtual.id,
        produtoId: Number(req.body.produto_id),
        quantidade: Math.max(1, Number(req.body.quantidade) || 1),
        formaPagamento: req.body.forma_pagamento || 'DINHEIRO',
        dinheiroEntregue: Math.max(0, Number(req.body.dinheiro_entregue) || 0),
        usuarioId: idUsuarioLogado || 1
      });

      res.redirect('/caixa');
    } catch (error) {
      console.error('Erro na venda rápida do caixa:', error);
      res.redirect('/caixa');
    }
  }
}

export const caixaController = new CaixaController();
export default caixaController;