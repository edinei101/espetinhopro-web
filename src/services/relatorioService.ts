import db from '../config/database';

export interface FiltroRelatorio {
  dataInicio: string;
  dataFim: string;
}

export class RelatorioService {
  async obterDadosRelatorio(filtro: FiltroRelatorio) {
    const { dataInicio, dataFim } = filtro;
    const inicio = `${dataInicio} 00:00:00`;
    const fim = `${dataFim} 23:59:59`;

    // 1. Métricas Globais (Comandas com status PAGA ou FECHADA)
    const [totaisRows]: any = await db.query(
      `SELECT 
         COUNT(id) AS total_comandas,
         COALESCE(SUM(subtotal), 0) AS total_produtos,
         COALESCE(SUM(taxa_servico), 0) AS total_gorjetas,
         COALESCE(SUM(desconto), 0) AS total_descontos,
         COALESCE(SUM(total_pago), SUM(valor_total), 0) AS faturamento_bruto
       FROM comandas
       WHERE status IN ('PAGA', 'FECHADA')
         AND (data_fechamento BETWEEN ? AND ? OR (data_fechamento IS NULL AND data_abertura BETWEEN ? AND ?))`,
      [inicio, fim, inicio, fim]
    );

    const totais = totaisRows[0] || {
      total_comandas: 0,
      total_produtos: 0,
      total_gorjetas: 0,
      total_descontos: 0,
      faturamento_bruto: 0
    };

    const ticketMedio = Number(totais.total_comandas) > 0
      ? Number(totais.faturamento_bruto) / Number(totais.total_comandas)
      : 0;

    // 2. Faturamento agrupado por Forma de Pagamento
    let pagamentosPorForma: any[] = [];
    try {
      const [formas]: any = await db.query(
        `SELECT 
           forma_pagamento,
           COALESCE(SUM(valor_pago), 0) AS total,
           COUNT(id) AS transacoes
         FROM pagamentos
         WHERE data_pagamento BETWEEN ? AND ?
         GROUP BY forma_pagamento
         ORDER BY total DESC`,
        [inicio, fim]
      );
      pagamentosPorForma = formas;
    } catch (e) {
      console.warn('Aviso: Não foi possível agrupar pagamentos:', e);
      pagamentosPorForma = [];
    }

    // 3. Top 10 Itens Mais Vendidos (comanda PAGA ou FECHADA)
    let itensMaisVendidos: any[] = [];
    try {
      const [itens]: any = await db.query(
        `SELECT 
           prod.nome AS produto_nome,
           cat.nome AS categoria_nome,
           SUM(pi.quantidade) AS quantidade_vendida,
           SUM(pi.quantidade * pi.preco_unitario) AS total_arrecadado
         FROM pedido_itens pi
         INNER JOIN pedidos ped ON ped.id = pi.pedido_id
         INNER JOIN comandas c ON c.id = ped.comanda_id
         INNER JOIN produtos prod ON prod.id = pi.produto_id
         LEFT JOIN categorias cat ON cat.id = prod.categoria_id
         WHERE c.status IN ('PAGA', 'FECHADA')
           AND (c.data_fechamento BETWEEN ? AND ? OR (c.data_fechamento IS NULL AND c.data_abertura BETWEEN ? AND ?))
         GROUP BY prod.id, prod.nome, cat.nome
         ORDER BY quantidade_vendida DESC
         LIMIT 10`,
        [inicio, fim, inicio, fim]
      );
      itensMaisVendidos = itens;
    } catch (e) {
      console.warn('Aviso: Falha ao consultar itens mais vendidos:', e);
      itensMaisVendidos = [];
    }

    // 4. Vendas e Gorjetas por Atendente (tenta atendente_id; se falhar, tenta garcom_id)
    let desempenhoGarcom: any[] = [];
    try {
      const [garcons]: any = await db.query(
        `SELECT 
           COALESCE(u.nome, 'Não Atribuído') AS garcom_nome,
           COUNT(c.id) AS comandas_atendidas,
           COALESCE(SUM(c.valor_total), 0) AS total_vendido,
           COALESCE(SUM(c.taxa_servico), 0) AS gorjeta_gerada
         FROM comandas c
         LEFT JOIN usuarios u ON u.id = c.atendente_id
         WHERE c.status IN ('PAGA', 'FECHADA')
           AND (c.data_fechamento BETWEEN ? AND ? OR (c.data_fechamento IS NULL AND c.data_abertura BETWEEN ? AND ?))
         GROUP BY c.atendente_id, u.nome
         ORDER BY total_vendido DESC`,
        [inicio, fim, inicio, fim]
      );
      desempenhoGarcom = garcons;
    } catch {
      try {
        const [garconsAlt]: any = await db.query(
          `SELECT 
             COALESCE(u.nome, 'Não Atribuído') AS garcom_nome,
             COUNT(c.id) AS comandas_atendidas,
             COALESCE(SUM(c.valor_total), 0) AS total_vendido,
             COALESCE(SUM(c.taxa_servico), 0) AS gorjeta_gerada
           FROM comandas c
           LEFT JOIN usuarios u ON u.id = c.garcom_id
           WHERE c.status IN ('PAGA', 'FECHADA')
             AND (c.data_fechamento BETWEEN ? AND ? OR (c.data_fechamento IS NULL AND c.data_abertura BETWEEN ? AND ?))
           GROUP BY c.garcom_id, u.nome
           ORDER BY total_vendido DESC`,
          [inicio, fim, inicio, fim]
        );
        desempenhoGarcom = garconsAlt;
      } catch {
        desempenhoGarcom = [];
      }
    }

    // 5. Histórico de repasse de gorjetas
    let repassesRows: any[] = [];
    try {
      const [repasses]: any = await db.query(
        `SELECT 
           rg.modalidade,
           u.nome AS usuario_nome,
           rg.valor_recebido,
           rg.observacao,
           rg.data_repasse
         FROM repasse_gorjetas rg
         INNER JOIN usuarios u ON u.id = rg.usuario_id
         WHERE rg.data_repasse BETWEEN ? AND ?
         ORDER BY rg.data_repasse DESC
         LIMIT 15`,
        [inicio, fim]
      );
      repassesRows = repasses;
    } catch (e) {
      console.warn('Aviso: Falha ao carregar repasses de gorjetas:', e);
      repassesRows = [];
    }

    return {
      totais: {
        ...totais,
        ticketMedio
      },
      pagamentosPorForma,
      itensMaisVendidos,
      desempenhoGarcom,
      repasses: repassesRows
    };
  }
}

export const relatorioService = new RelatorioService();