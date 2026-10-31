import db from '../config/database';

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
  taxaPercentual: number;
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

export class CaixaService {
  // 1. Obter caixa aberto atualmente no sistema
  async obterCaixaAberto(): Promise<any | null> {
    const [caixasAbertos]: any = await db.query(
      `SELECT c.*, u.nome AS operador_nome, u.email AS operador_login
       FROM caixas c
       LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.status = 'ABERTO' 
       ORDER BY c.id DESC LIMIT 1`
    );
    return caixasAbertos.length > 0 ? caixasAbertos[0] : null;
  }

  // 2. Calcular resumo financeiro e listas do turno atual
  async obterResumoTurno(caixaId: number, valorInicial: number) {
    const [pagamentosTurno]: any = await db.query(
      `SELECT forma_pagamento, valor_pago, valor_taxa, troco
       FROM pagamentos 
       WHERE caixa_id = ?`,
      [caixaId]
    );

    let totalVendas = 0;
    let totalTaxas = 0;
    let totalDinheiro = Number(valorInicial) || 0;
    let totalPix = 0;
    let totalCartao = 0;

    for (const p of pagamentosTurno) {
      const vPago = Number(p.valor_pago) || 0;
      const vTaxa = Number(p.valor_taxa) || 0;
      const forma = p.forma_pagamento;

      totalVendas += vPago;
      totalTaxas += vTaxa;

      if (forma === 'DINHEIRO') {
        totalDinheiro += (vPago + vTaxa);
      } else if (forma === 'PIX') {
        totalPix += (vPago + vTaxa);
      } else {
        totalCartao += (vPago + vTaxa);
      }
    }

    const resumo = {
      totalVendas: Number(totalVendas.toFixed(2)),
      totalTaxas: Number(totalTaxas.toFixed(2)),
      totalDinheiro: Number(totalDinheiro.toFixed(2)),
      totalPix: Number(totalPix.toFixed(2)),
      totalCartao: Number(totalCartao.toFixed(2)),
      saldoGavetaEsperado: Number(totalDinheiro.toFixed(2))
    };

    const [garconsDoTurno]: any = await db.query(
      `SELECT u.id, u.nome, COALESCE(SUM(p.valor_taxa), 0) AS taxa_gerada
       FROM usuarios u
       LEFT JOIN comandas c ON c.atendente_id = u.id AND c.status = 'PAGA'
       LEFT JOIN pagamentos p ON p.comanda_id = c.id AND p.caixa_id = ?
       WHERE u.ativo = 1 AND u.perfil_id = 2
       GROUP BY u.id, u.nome`,
      [caixaId]
    );

    const [funcionariosTurno]: any = await db.query(
      `SELECT id, nome, perfil_id FROM usuarios WHERE ativo = 1 ORDER BY nome ASC`
    );

    return { resumo, garconsDoTurno, funcionariosTurno };
  }

  // 3. Obter comandas que aguardam pagamento
  async listarComandasAguardando(taxaServicoPadrao: number): Promise<any[]> {
    const [comandas]: any = await db.query(
      `SELECT c.*, m.numero AS mesa_numero, u.nome AS atendente_nome
       FROM comandas c
       LEFT JOIN mesas m ON m.id = c.mesa_id
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.status = 'AGUARDANDO_PAGAMENTO'
       ORDER BY c.data_abertura ASC`
    );

    comandas.forEach((c: any) => {
      const sub = Number(c.subtotal) || 0;
      const desc = Number(c.desconto) || 0;
      const pago = Number(c.total_pago) || 0;
      const taxa = Number(((sub * taxaServicoPadrao) / 100).toFixed(2));
      c.taxa_calculada = taxa;
      c.valor_total = Math.max(0, Number((sub + taxa - desc).toFixed(2)));
      c.saldo_restante = Math.max(0, Number((c.valor_total - pago).toFixed(2)));
    });

    return comandas;
  }

  // 4. Obter produtos da categoria Checkout
  async listarProdutosCheckout(): Promise<any[]> {
    const [produtos]: any = await db.query(
      `SELECT p.*, c.nome AS categoria_nome
       FROM produtos p
       INNER JOIN categorias c ON c.id = p.categoria_id
       WHERE p.ativo = 1 AND (c.id = 4 OR LOWER(c.nome) LIKE '%checkout%' OR LOWER(c.nome) LIKE '%doce%')
       ORDER BY p.nome ASC`
    );
    return produtos;
  }

  // 5. Obter comanda selecionada com itens e histórico de pagamentos
  async obterDetalhesComanda(comandaId: number, taxaServicoPadrao: number) {
    const [detalheComanda]: any = await db.query(
      `SELECT c.*, m.numero AS mesa_numero, u.nome AS atendente_nome
       FROM comandas c
       LEFT JOIN mesas m ON m.id = c.mesa_id
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.id = ? AND c.status = 'AGUARDANDO_PAGAMENTO' LIMIT 1`,
      [comandaId]
    );

    if (detalheComanda.length === 0) {
      return null;
    }

    const cSel = detalheComanda[0];
    const sub = Number(cSel.subtotal) || 0;
    const desc = Number(cSel.desconto) || 0;
    const pago = Number(cSel.total_pago) || 0;
    const taxa = Number(((sub * taxaServicoPadrao) / 100).toFixed(2));

    cSel.taxa_calculada = taxa;
    cSel.valor_total = Math.max(0, Number((sub + taxa - desc).toFixed(2)));
    cSel.saldo_restante = Math.max(0, Number((cSel.valor_total - pago).toFixed(2)));

    let itens: any[] = [];
    try {
      const [itensRows]: any = await db.query(
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
        [comandaId]
      );
      itens = itensRows;
    } catch {
      const [itensRowsAlt]: any = await db.query(
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
        [comandaId]
      );
      itens = itensRowsAlt;
    }

    const [pagamentos]: any = await db.query(
      `SELECT * FROM pagamentos 
       WHERE comanda_id = ? 
       ORDER BY data_pagamento ASC`,
      [comandaId]
    );

    return {
      comandaSelecionada: cSel,
      itensComanda: itens,
      pagamentosRealizados: pagamentos
    };
  }

  // 6. Abrir turno de caixa
  async abrirCaixa(usuarioId: number, valorInicial: number): Promise<void> {
    const [caixaAberto]: any = await db.query("SELECT id FROM caixas WHERE status = 'ABERTO' LIMIT 1");
    if (caixaAberto.length > 0) {
      throw new Error('Já existe um caixa aberto no momento.');
    }

    await db.query(
      `INSERT INTO caixas (usuario_id, data_abertura, valor_inicial, status)
       VALUES (?, NOW(), ?, 'ABERTO')`,
      [usuarioId, valorInicial]
    );
  }

  // 7. Fechar turno de caixa com rateio de gorjetas
  async fecharCaixa(dados: FecharCaixaDTO): Promise<void> {
    const { caixaId, valorFinal, modalidadeRateio, totalTaxaTurno, funcionariosRateio } = dados;

    if (totalTaxaTurno > 0) {
      if (modalidadeRateio === 'POR_GARCOM') {
        const [taxasPorGarcom]: any = await db.query(
          `SELECT c.atendente_id AS usuario_id, COALESCE(SUM(p.valor_taxa), 0) AS valor
           FROM comandas c
           INNER JOIN pagamentos p ON p.comanda_id = c.id
           WHERE p.caixa_id = ? AND c.atendente_id IS NOT NULL
           GROUP BY c.atendente_id`,
          [caixaId]
        );

        for (const item of taxasPorGarcom) {
          if (Number(item.valor) > 0) {
            await db.query(
              `INSERT INTO repasse_gorjetas (data_repasse, modalidade, usuario_id, valor_recebido, observacao)
               VALUES (NOW(), 'POR_GARCOM', ?, ?, 'Comissão individual por mesas atendidas no turno #${caixaId}')`,
              [item.usuario_id, item.valor]
            );
          }
        }
      } else if (modalidadeRateio === 'RATEIO_TURNO') {
        let idsFuncionarios = funcionariosRateio;
        if (!Array.isArray(idsFuncionarios)) {
          idsFuncionarios = idsFuncionarios ? [idsFuncionarios] : [];
        }

        if (idsFuncionarios.length > 0) {
          const valorPorFuncionario = Number((totalTaxaTurno / idsFuncionarios.length).toFixed(2));
          for (const funcId of idsFuncionarios) {
            await db.query(
              `INSERT INTO repasse_gorjetas (data_repasse, modalidade, usuario_id, valor_recebido, observacao)
               VALUES (NOW(), 'RATEIO_TURNO', ?, ?, 'Rateio igualitário entre ${idsFuncionarios.length} funcionários no turno #${caixaId}')`,
              [Number(funcId), valorPorFuncionario]
            );
          }
        }
      }
    }

    await db.query(
      `UPDATE caixas 
       SET status = 'FECHADO', data_fechamento = NOW(), valor_final = ?
       WHERE id = ?`,
      [valorFinal, caixaId]
    );
  }

  // 8. Adicionar item de checkout (doce/bala) à comanda
  async adicionarItemCheckout(dados: AdicionarCheckoutDTO): Promise<void> {
    const { comandaId, produtoId, quantidade, usuarioId } = dados;

    const [prodRows]: any = await db.query('SELECT preco FROM produtos WHERE id = ? LIMIT 1', [produtoId]);
    if (prodRows.length === 0) {
      throw new Error('Produto não encontrado.');
    }

    const precoUnit = Number(prodRows[0].preco);

    let pedidoId: number;
    const [pedidosExistentes]: any = await db.query(
      `SELECT p.id 
       FROM pedidos p
       INNER JOIN pedido_itens pi ON pi.pedido_id = p.id
       INNER JOIN produtos prod ON prod.id = pi.produto_id
       WHERE p.comanda_id = ? 
         AND p.status_preparo = 'PRONTO'
         AND prod.categoria_id = 4
       ORDER BY p.id DESC LIMIT 1`,
      [comandaId]
    );

    if (pedidosExistentes.length > 0) {
      pedidoId = pedidosExistentes[0].id;
    } else {
      const [novoPed]: any = await db.query(
        `INSERT INTO pedidos (comanda_id, usuario_id, data_criacao, status_preparo)
         VALUES (?, ?, NOW(), 'PRONTO')`,
        [comandaId, usuarioId]
      );
      pedidoId = novoPed.insertId;
    }

    try {
      await db.query(
        `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, observacao)
         VALUES (?, ?, ?, ?, 'Adicionado no Caixa')`,
        [pedidoId, produtoId, quantidade, precoUnit]
      );
    } catch {
      await db.query(
        `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, observacoes)
         VALUES (?, ?, ?, ?, 'Adicionado no Caixa')`,
        [pedidoId, produtoId, quantidade, precoUnit]
      );
    }

    await db.query(
      `UPDATE comandas c
       SET c.subtotal = (
         SELECT COALESCE(SUM(pi.quantidade * pi.preco_unitario), 0)
         FROM pedido_itens pi
         INNER JOIN pedidos ped ON ped.id = pi.pedido_id
         WHERE ped.comanda_id = ?
       ),
       c.valor_total = c.subtotal + c.taxa_servico - c.desconto
       WHERE c.id = ?`,
      [comandaId, comandaId]
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
      dinheiroEntregue
    } = dados;

    const [comandaRows]: any = await db.query(
      "SELECT * FROM comandas WHERE id = ? AND status = 'AGUARDANDO_PAGAMENTO' LIMIT 1",
      [comandaId]
    );

    if (comandaRows.length === 0 || valorAbater <= 0) {
      throw new Error('Comanda inválida ou valor informado nulo.');
    }

    const comanda = comandaRows[0];
    const subtotal = Number(comanda.subtotal) || 0;
    const totalJaPago = Number(comanda.total_pago) || 0;

    const taxaServico = aplicarTaxa ? Number(((subtotal * taxaPercentual) / 100).toFixed(2)) : 0.00;
    const valorTotalAtualizado = Math.max(0, Number((subtotal + taxaServico - desconto).toFixed(2)));
    const saldoRestante = Math.max(0, Number((valorTotalAtualizado - totalJaPago).toFixed(2)));
    const valorAmortizadoEfetivo = Math.min(valorAbater, saldoRestante);

    let taxaDestePagamento = 0;
    if (aplicarTaxa && valorTotalAtualizado > 0) {
      const proporcaoTaxa = taxaServico / valorTotalAtualizado;
      taxaDestePagamento = Number((valorAmortizadoEfetivo * proporcaoTaxa).toFixed(2));
    }
    const valorLiquidoProdutos = Number((valorAmortizadoEfetivo - taxaDestePagamento).toFixed(2));

    const troco = formaPagamento === 'DINHEIRO' && dinheiroEntregue > valorAmortizadoEfetivo
      ? Number((dinheiroEntregue - valorAmortizadoEfetivo).toFixed(2))
      : 0.00;

    await db.query(
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
        taxaDestePagamento
      ]
    );

    const novoTotalPago = Number((totalJaPago + valorAmortizadoEfetivo).toFixed(2));
    const quitou = novoTotalPago >= valorTotalAtualizado;

    await db.query(
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
        comandaId
      ]
    );

    if (quitou && comanda.mesa_id) {
      await db.query('UPDATE mesas SET status = "LIVRE" WHERE id = ?', [comanda.mesa_id]);
    }

    return { quitou };
  }

  // 10. Venda rápida avulsa no caixa
  async processarVendaRapida(dados: VendaRapidaDTO): Promise<number> {
    const { caixaId, produtoId, quantidade, formaPagamento, dinheiroEntregue, usuarioId } = dados;

    const [prodRows]: any = await db.query('SELECT nome, preco FROM produtos WHERE id = ? LIMIT 1', [produtoId]);
    if (prodRows.length === 0) {
      throw new Error('Produto não encontrado.');
    }

    const precoUnit = Number(prodRows[0].preco);
    const totalVenda = Number((precoUnit * quantidade).toFixed(2));
    const valorRecebidoEfetivo = formaPagamento === 'DINHEIRO' && dinheiroEntregue > totalVenda ? dinheiroEntregue : totalVenda;
    const troco = formaPagamento === 'DINHEIRO' && dinheiroEntregue > totalVenda ? Number((dinheiroEntregue - totalVenda).toFixed(2)) : 0;

    const [resComanda]: any = await db.query(
      `INSERT INTO comandas (
         tipo, nome_cliente, atendente_id, data_abertura, data_fechamento, status,
         subtotal, taxa_servico, desconto, valor_total, total_pago, valor_recebido, troco
       ) VALUES ('BALCAO', 'Venda Checkout', ?, NOW(), NOW(), 'PAGA', ?, 0, 0, ?, ?, ?, ?)`,
      [usuarioId, totalVenda, totalVenda, totalVenda, valorRecebidoEfetivo, troco]
    );
    const comandaId = resComanda.insertId;

    const [resPedido]: any = await db.query(
      `INSERT INTO pedidos (comanda_id, usuario_id, data_criacao, status_preparo)
       VALUES (?, ?, NOW(), 'PRONTO')`,
      [comandaId, usuarioId]
    );
    const pedidoId = resPedido.insertId;

    try {
      await db.query(
        `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, observacao)
         VALUES (?, ?, ?, ?, 'Venda Rápida de Caixa')`,
        [pedidoId, produtoId, quantidade, precoUnit]
      );
    } catch {
      await db.query(
        `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, observacoes)
         VALUES (?, ?, ?, ?, 'Venda Rápida de Caixa')`,
        [pedidoId, produtoId, quantidade, precoUnit]
      );
    }

    await db.query(
      `INSERT INTO pagamentos (
         comanda_id, caixa_id, valor_pago, forma_pagamento, data_pagamento,
         valor_recebido, troco, valor_taxa
       ) VALUES (?, ?, ?, ?, NOW(), ?, ?, 0)`,
      [comandaId, caixaId, totalVenda, formaPagamento, valorRecebidoEfetivo, troco]
    );

    return comandaId;
  }
}

export const caixaService = new CaixaService();