import { Injectable } from '@nestjs/common';
import { AppDataSource } from '../../config/database/typeorm.provider';

export interface FecharCaixaDTO {
  caixaId: number;
  valorFinal: number;
  modalidadeRateio?: string;
  totalTaxaTurno: number;
  funcionariosRateio?: string | string[] | number | number[];
}

export interface AdicionarCheckoutDTO {
  comandaId: number;
  produtoId: number;
  quantidade: number;
  usuarioId: number;
}

export interface ProcessarPagamentoDTO {
  comandaId: number;
  caixaId: number;
  formaPagamento: string;
  aplicarTaxa: boolean;
  taxaPercentual?: number;
  desconto: number;
  valorAbater: number;
  dinheiroEntregue: number;
}

export interface VendaRapidaDTO {
  caixaId: number;
  produtoId: number;
  quantidade: number;
  formaPagamento: string;
  dinheiroEntregue: number;
  usuarioId: number;
}

@Injectable()
export class CaixaService {
  // Retorna a taxa padrão lida dinamicamente do .env (fallback: 10)
  obterTaxaServicoPadrao(): number {
    return Number(process.env.TAXA_SERVICO_PERCENTUAL) || 10;
  }

  // 1. Obter caixa aberto atualmente no sistema
  async obterCaixaAberto(): Promise<any | null> {
    const caixasAbertos = await AppDataSource.query(
      `SELECT c.*, u.nome AS operador_nome, u.email AS operador_login
       FROM caixas c
       LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.status = 'ABERTO' 
       ORDER BY c.id DESC LIMIT 1`,
    );
    return caixasAbertos.length > 0 ? caixasAbertos[0] : null;
  }

  // 2. Calcular resumo financeiro e listas do turno atual
  async obterResumoTurno(caixaId: number, valorInicial: number) {
    const pagamentosTurno = await AppDataSource.query(
      `SELECT 
         p.forma_pagamento, 
         p.valor_pago, 
         p.valor_taxa, 
         p.troco,
         p.comanda_id,
         c.taxa_servico AS comanda_taxa_servico
       FROM pagamentos p
       LEFT JOIN comandas c ON c.id = p.comanda_id
       WHERE p.caixa_id = ?`,
      [caixaId],
    );

    let totalVendas = 0;
    let totalTaxas = 0;
    let totalDinheiro = Number(valorInicial) || 0;
    let totalPix = 0;
    let totalCartao = 0;

    const comandasTaxaContabilizada = new Set<number>();

    for (const p of pagamentosTurno) {
      const vPago = Number(p.valor_pago) || 0;
      let vTaxa = Number(p.valor_taxa) || 0;

      if (vTaxa === 0 && p.comanda_id && Number(p.comanda_taxa_servico) > 0) {
        if (!comandasTaxaContabilizada.has(Number(p.comanda_id))) {
          vTaxa = Number(p.comanda_taxa_servico) || 0;
          comandasTaxaContabilizada.add(Number(p.comanda_id));
        }
      }

      const forma = p.forma_pagamento;

      totalVendas += vPago;
      totalTaxas += vTaxa;

      if (forma === 'DINHEIRO') {
        totalDinheiro += vPago + vTaxa;
      } else if (forma === 'PIX') {
        totalPix += vPago + vTaxa;
      } else {
        totalCartao += vPago + vTaxa;
      }
    }

    const resumo = {
      totalVendas: Number(totalVendas.toFixed(2)),
      totalTaxas: Number(totalTaxas.toFixed(2)),
      totalDinheiro: Number(totalDinheiro.toFixed(2)),
      totalPix: Number(totalPix.toFixed(2)),
      totalCartao: Number(totalCartao.toFixed(2)),
      saldoGavetaEsperado: Number(totalDinheiro.toFixed(2)),
    };

    // Busca todos os atendentes que geraram taxa neste turno (independente do perfil_id) + garçons ativos
    const garconsDoTurno = await AppDataSource.query(
      `SELECT 
         u.id, 
         u.nome, 
         COALESCE(SUM(
           CASE 
             WHEN p.valor_taxa > 0 THEN p.valor_taxa 
             WHEN p.id IS NOT NULL THEN c.taxa_servico 
             ELSE 0 
           END
         ), 0) AS taxa_gerada
       FROM usuarios u
       LEFT JOIN comandas c ON c.atendente_id = u.id AND c.status IN ('PAGA', 'FECHADA')
       LEFT JOIN pagamentos p ON p.comanda_id = c.id AND p.caixa_id = ?
       WHERE u.ativo = 1
       GROUP BY u.id, u.nome, u.perfil_id
       HAVING taxa_gerada > 0 OR u.perfil_id = 2
       ORDER BY taxa_gerada DESC, u.nome ASC`,
      [caixaId],
    );

    const funcionariosTurno = await AppDataSource.query(
      `SELECT id, nome, perfil_id FROM usuarios WHERE ativo = 1 ORDER BY nome ASC`,
    );

    return { resumo, garconsDoTurno, funcionariosTurno };
  }

  // 3. Obter comandas que aguardam pagamento (usa taxa do .env se não passada)
  async listarComandasAguardando(taxaServicoPadrao?: number): Promise<any[]> {
    const taxaEfetiva =
      taxaServicoPadrao !== undefined ? taxaServicoPadrao : this.obterTaxaServicoPadrao();

    const comandas = await AppDataSource.query(
      `SELECT c.*, m.numero AS mesa_numero, u.nome AS atendente_nome
       FROM comandas c
       LEFT JOIN mesas m ON m.id = c.mesa_id
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.status = 'AGUARDANDO_PAGAMENTO'
       ORDER BY c.data_abertura ASC`,
    );

    comandas.forEach((c: any) => {
      const sub = Number(c.subtotal) || 0;
      const desc = Number(c.desconto) || 0;
      const pago = Number(c.total_pago) || 0;
      const taxa = Number(((sub * taxaEfetiva) / 100).toFixed(2));
      c.taxa_calculada = taxa;
      c.valor_total = Math.max(0, Number((sub + taxa - desc).toFixed(2)));
      c.saldo_restante = Math.max(0, Number((c.valor_total - pago).toFixed(2)));
    });

    return comandas;
  }

  // 4. Obter produtos da categoria Checkout
  async listarProdutosCheckout(): Promise<any[]> {
    const produtos = await AppDataSource.query(
      `SELECT p.*, c.nome AS categoria_nome
       FROM produtos p
       INNER JOIN categorias c ON c.id = p.categoria_id
       WHERE p.ativo = 1 AND (c.id = 4 OR LOWER(c.nome) LIKE '%checkout%' OR LOWER(c.nome) LIKE '%doce%')
       ORDER BY p.nome ASC`,
    );
    return produtos;
  }

  // 5. Obter comanda selecionada com itens e histórico (usa taxa do .env se não passada)
  async obterDetalhesComanda(comandaId: number, taxaServicoPadrao?: number) {
    const taxaEfetiva =
      taxaServicoPadrao !== undefined ? taxaServicoPadrao : this.obterTaxaServicoPadrao();

    const detalheComanda = await AppDataSource.query(
      `SELECT c.*, m.numero AS mesa_numero, u.nome AS atendente_nome
       FROM comandas c
       LEFT JOIN mesas m ON m.id = c.mesa_id
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.id = ? AND c.status = 'AGUARDANDO_PAGAMENTO' LIMIT 1`,
      [comandaId],
    );

    if (detalheComanda.length === 0) {
      return null;
    }

    const cSel = detalheComanda[0];
    const sub = Number(cSel.subtotal) || 0;
    const desc = Number(cSel.desconto) || 0;
    const pago = Number(cSel.total_pago) || 0;
    const taxa = Number(((sub * taxaEfetiva) / 100).toFixed(2));

    cSel.taxa_calculada = taxa;
    cSel.valor_total = Math.max(0, Number((sub + taxa - desc).toFixed(2)));
    cSel.saldo_restante = Math.max(0, Number((cSel.valor_total - pago).toFixed(2)));

    let itens: any[] = [];
    try {
      itens = await AppDataSource.query(
        `SELECT 
           pi.id,
           pi.quantidade,
           pi.preco_unitario,
           (pi.quantidade * pi.preco_unitario) AS valor_total,
           pi.ponto_carne,
           pi.observacao,
           prod.nome AS produto_nome,
           prod.categoria_id
         FROM pedido_itens pi
         INNER JOIN pedidos p ON p.id = pi.pedido_id
         INNER JOIN produtos prod ON prod.id = pi.produto_id
         WHERE p.comanda_id = ?
         ORDER BY pi.id ASC`,
        [comandaId],
      );
    } catch {
      itens = await AppDataSource.query(
        `SELECT 
           pi.id,
           pi.quantidade,
           pi.preco_unitario,
           (pi.quantidade * pi.preco_unitario) AS valor_total,
           pi.ponto_carne,
           pi.observacoes AS observacao,
           prod.nome AS produto_nome,
           prod.categoria_id
         FROM pedido_itens pi
         INNER JOIN pedidos p ON p.id = pi.pedido_id
         INNER JOIN produtos prod ON prod.id = pi.produto_id
         WHERE p.comanda_id = ?
         ORDER BY pi.id ASC`,
        [comandaId],
      );
    }

    const pagamentos = await AppDataSource.query(
      `SELECT * FROM pagamentos 
       WHERE comanda_id = ? 
       ORDER BY data_pagamento ASC`,
      [comandaId],
    );

    return {
      comandaSelecionada: cSel,
      itensComanda: itens,
      pagamentosRealizados: pagamentos,
    };
  }

  // 6. Abrir turno de caixa
  async abrirCaixa(usuarioId: number, valorInicial: number): Promise<void> {
    const caixaAberto = await AppDataSource.query(
      "SELECT id FROM caixas WHERE status = 'ABERTO' LIMIT 1",
    );
    if (caixaAberto.length > 0) {
      throw new Error('Já existe um caixa aberto no momento.');
    }

    await AppDataSource.query(
      `INSERT INTO caixas (usuario_id, data_abertura, valor_inicial, status)
       VALUES (?, NOW(), ?, 'ABERTO')`,
      [usuarioId, valorInicial],
    );
  }

  // 7. Fechar turno de caixa com rateio de gorjetas
  async fecharCaixa(dados: FecharCaixaDTO): Promise<void> {
    const { caixaId, valorFinal, modalidadeRateio, totalTaxaTurno, funcionariosRateio } = dados;

    const resumoAtual = await this.obterResumoTurno(caixaId, 0);
    const taxaEfetivaTurno =
      Number(totalTaxaTurno) > 0
        ? Number(totalTaxaTurno)
        : Number(resumoAtual.resumo.totalTaxas || 0);

    if (taxaEfetivaTurno > 0) {
      if (modalidadeRateio === 'POR_GARCOM') {
        for (const item of resumoAtual.garconsDoTurno) {
          const valorComissao = Number(item.taxa_gerada) || 0;
          if (valorComissao > 0) {
            await AppDataSource.query(
              `INSERT INTO repasse_gorjetas (data_repasse, modalidade, usuario_id, valor_recebido, observacao)
               VALUES (NOW(), 'POR_GARCOM', ?, ?, ?)`,
              [
                item.id,
                valorComissao,
                `Comissão individual por mesas atendidas no turno #${caixaId}`,
              ],
            );
          }
        }
      } else if (modalidadeRateio === 'RATEIO_TURNO') {
        let idsFuncionarios: any[] = [];
        if (Array.isArray(funcionariosRateio)) {
          idsFuncionarios = funcionariosRateio;
        } else if (
          funcionariosRateio !== undefined &&
          funcionariosRateio !== null &&
          funcionariosRateio !== ''
        ) {
          idsFuncionarios = [funcionariosRateio];
        }

        if (idsFuncionarios.length > 0) {
          const valorPorFuncionario = Number((taxaEfetivaTurno / idsFuncionarios.length).toFixed(2));
          for (const funcId of idsFuncionarios) {
            await AppDataSource.query(
              `INSERT INTO repasse_gorjetas (data_repasse, modalidade, usuario_id, valor_recebido, observacao)
               VALUES (NOW(), 'RATEIO_TURNO', ?, ?, ?)`,
              [
                Number(funcId),
                valorPorFuncionario,
                `Rateio igualitário entre ${idsFuncionarios.length} funcionários no turno #${caixaId}`,
              ],
            );
          }
        }
      }
    }

    await AppDataSource.query(
      `UPDATE caixas 
       SET status = 'FECHADO', data_fechamento = NOW(), valor_final = ?
       WHERE id = ?`,
      [valorFinal, caixaId],
    );
  }

  // 8. Adicionar item de checkout (doce/bala) à comanda
  async adicionarItemCheckout(dados: AdicionarCheckoutDTO): Promise<void> {
    const { comandaId, produtoId, quantidade, usuarioId } = dados;

    const prodRows = await AppDataSource.query(
      'SELECT preco FROM produtos WHERE id = ? LIMIT 1',
      [produtoId],
    );
    if (prodRows.length === 0) {
      throw new Error('Produto não encontrado.');
    }

    const precoUnit = Number(prodRows[0].preco);

    let pedidoId: number;
    const pedidosExistentes = await AppDataSource.query(
      `SELECT p.id 
       FROM pedidos p
       INNER JOIN pedido_itens pi ON pi.pedido_id = p.id
       INNER JOIN produtos prod ON prod.id = pi.produto_id
       WHERE p.comanda_id = ? 
         AND p.status_preparo = 'PRONTO'
         AND prod.categoria_id = 4
       ORDER BY p.id DESC LIMIT 1`,
      [comandaId],
    );

    if (pedidosExistentes.length > 0) {
      pedidoId = pedidosExistentes[0].id;
    } else {
      const novoPed = await AppDataSource.query(
        `INSERT INTO pedidos (comanda_id, usuario_id, data_criacao, status_preparo)
         VALUES (?, ?, NOW(), 'PRONTO')`,
        [comandaId, usuarioId],
      );
      pedidoId = novoPed.insertId;
    }

    try {
      await AppDataSource.query(
        `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, observacao)
         VALUES (?, ?, ?, ?, 'Adicionado no Caixa')`,
        [pedidoId, produtoId, quantidade, precoUnit],
      );
    } catch {
      await AppDataSource.query(
        `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, observacoes)
         VALUES (?, ?, ?, ?, 'Adicionado no Caixa')`,
        [pedidoId, produtoId, quantidade, precoUnit],
      );
    }

    await AppDataSource.query(
      `UPDATE comandas c
       SET c.subtotal = (
         SELECT COALESCE(SUM(pi.quantidade * pi.preco_unitario), 0)
         FROM pedido_itens pi
         INNER JOIN pedidos ped ON ped.id = pi.pedido_id
         WHERE ped.comanda_id = ?
       ),
       c.valor_total = c.subtotal + c.taxa_servico - c.desconto
       WHERE c.id = ?`,
      [comandaId, comandaId],
    );
  }

  // 9. Processar pagamento parcial ou total
  async processarPagamento(dados: ProcessarPagamentoDTO): Promise<{ quitou: boolean }> {
    const {
      comandaId,
      caixaId,
      formaPagamento,
      aplicarTaxa,
      taxaPercentual,
      desconto,
      valorAbater,
      dinheiroEntregue,
    } = dados;

    const percentualEfetivo =
      taxaPercentual !== undefined && taxaPercentual !== null
        ? Number(taxaPercentual)
        : this.obterTaxaServicoPadrao();

    const comandaRows = await AppDataSource.query(
      "SELECT * FROM comandas WHERE id = ? AND status = 'AGUARDANDO_PAGAMENTO' LIMIT 1",
      [comandaId],
    );

    if (comandaRows.length === 0 || valorAbater <= 0) {
      throw new Error('Comanda inválida ou valor informado nulo.');
    }

    const comanda = comandaRows[0];
    const subtotal = Number(comanda.subtotal) || 0;
    const totalJaPago = Number(comanda.total_pago) || 0;

    const taxaServico = aplicarTaxa
      ? Number(((subtotal * percentualEfetivo) / 100).toFixed(2))
      : 0.0;
    const valorTotalAtualizado = Math.max(
      0,
      Number((subtotal + taxaServico - desconto).toFixed(2)),
    );
    const saldoRestante = Math.max(0, Number((valorTotalAtualizado - totalJaPago).toFixed(2)));
    const valorAmortizadoEfetivo = Math.min(valorAbater, saldoRestante);

    let taxaDestePagamento = 0;
    if (aplicarTaxa && valorTotalAtualizado > 0) {
      const proporcaoTaxa = taxaServico / valorTotalAtualizado;
      taxaDestePagamento = Number((valorAmortizadoEfetivo * proporcaoTaxa).toFixed(2));
    }
    const valorLiquidoProdutos = Number((valorAmortizadoEfetivo - taxaDestePagamento).toFixed(2));

    const troco =
      formaPagamento === 'DINHEIRO' && dinheiroEntregue > valorAmortizadoEfetivo
        ? Number((dinheiroEntregue - valorAmortizadoEfetivo).toFixed(2))
        : 0.0;

    await AppDataSource.query(
      `INSERT INTO pagamentos (
         comanda_id, caixa_id, valor_pago, forma_pagamento, data_pagamento, 
         valor_recebido, troco, valor_taxa
       ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [
        comandaId,
        caixaId,
        valorLiquidoProdutos,
        formaPagamento,
        dinheiroEntregue,
        troco,
        taxaDestePagamento,
      ],
    );

    const novoTotalPago = Number((totalJaPago + valorAmortizadoEfetivo).toFixed(2));
    const quitou = novoTotalPago >= valorTotalAtualizado;

    await AppDataSource.query(
      `UPDATE comandas 
       SET taxa_servico = ?,
           desconto = ?,
           valor_total = ?,
           total_pago = ?,
           valor_recebido = (valor_recebido + ?),
           troco = (troco + ?),
           status = ?,
           data_fechamento = ?
       WHERE id = ?`,
      [
        taxaServico,
        desconto,
        valorTotalAtualizado,
        novoTotalPago,
        dinheiroEntregue,
        troco,
        quitou ? 'PAGA' : 'AGUARDANDO_PAGAMENTO',
        quitou ? new Date() : null,
        comandaId,
      ],
    );

    if (quitou && comanda.mesa_id) {
      await AppDataSource.query('UPDATE mesas SET status = "LIVRE" WHERE id = ?', [
        comanda.mesa_id,
      ]);
    }

    return { quitou };
  }

  // 10. Venda rápida avulsa no caixa
  async processarVendaRapida(dados: any): Promise<number> {
    const {
      caixaId,
      usuarioId,
      produtoId,
      quantidade,
      itens,
      formaPagamento,
      desconto,
      valorRecebido,
      dinheiro_entregue,
    } = dados;

    let listaItens: any[] = [];
    if (Array.isArray(itens) && itens.length > 0) {
      listaItens = itens;
    } else if (produtoId) {
      listaItens = [{ produto_id: produtoId, quantidade: quantidade || 1 }];
    }

    if (listaItens.length === 0) {
      throw new Error('Nenhum produto foi selecionado para a venda rápida.');
    }

    const comandaRes = await AppDataSource.query(
      `INSERT INTO comandas (tipo, status, atendente_id, data_abertura, data_fechamento, subtotal, desconto, valor_total, total_pago)
       VALUES ('BALCAO', 'PAGA', ?, NOW(), NOW(), 0, ?, 0, 0)`,
      [usuarioId, Number(desconto) || 0],
    );
    const comandaId = comandaRes.insertId;

    const pedidoRes = await AppDataSource.query(
      `INSERT INTO pedidos (comanda_id, usuario_id, data_criacao, status_preparo)
       VALUES (?, ?, NOW(), 'PRONTO')`,
      [comandaId, usuarioId],
    );
    const pedidoId = pedidoRes.insertId;

    let subtotalCalculado = 0;

    for (const item of listaItens) {
      const pId = Number(item.produto_id);
      const qtd = Number(item.quantidade) || 1;

      if (!pId || qtd <= 0) continue;

      const prodRows = await AppDataSource.query(
        'SELECT preco FROM produtos WHERE id = ? LIMIT 1',
        [pId],
      );

      if (prodRows.length > 0) {
        const precoUnit = Number(prodRows[0].preco);
        subtotalCalculado += precoUnit * qtd;

        try {
          await AppDataSource.query(
            `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, observacao)
             VALUES (?, ?, ?, ?, 'Venda Rápida Balcão')`,
            [pedidoId, pId, qtd, precoUnit],
          );
        } catch {
          await AppDataSource.query(
            `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, observacoes)
             VALUES (?, ?, ?, ?, 'Venda Rápida Balcão')`,
            [pedidoId, pId, qtd, precoUnit],
          );
        }
      }
    }

    const descVal = Number(desconto) || 0;
    const valorTotal = Math.max(0, Number((subtotalCalculado - descVal).toFixed(2)));
    const entregueRaw = valorRecebido ?? dinheiro_entregue;
    const dinheiroEntregue = entregueRaw !== undefined ? Number(entregueRaw) : valorTotal;
    const troco =
      formaPagamento === 'DINHEIRO' && dinheiroEntregue > valorTotal
        ? Number((dinheiroEntregue - valorTotal).toFixed(2))
        : 0.0;

    await AppDataSource.query(
      `UPDATE comandas
       SET subtotal = ?, valor_total = ?, total_pago = ?, valor_recebido = ?, troco = ?
       WHERE id = ?`,
      [subtotalCalculado, valorTotal, valorTotal, dinheiroEntregue, troco, comandaId],
    );

    await AppDataSource.query(
      `INSERT INTO pagamentos (comanda_id, caixa_id, valor_pago, forma_pagamento, data_pagamento, valor_recebido, troco, valor_taxa)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, 0)`,
      [comandaId, caixaId || null, valorTotal, formaPagamento, dinheiroEntregue, troco],
    );

    return comandaId;
  }
}