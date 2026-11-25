import { Injectable } from '@nestjs/common';
import { AppDataSource } from '../../config/database/typeorm.provider';

@Injectable()
export class ImpressaoService {
  // 1. Dados completos para o Cupom da Pré-Conta / Conferência
  async obterDadosConta(comandaId: number) {
    const comandas = await AppDataSource.query(
      `SELECT c.*, m.numero AS mesa_numero, u.nome AS atendente_nome
       FROM comandas c
       LEFT JOIN mesas m ON m.id = c.mesa_id
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.id = ? LIMIT 1`,
      [comandaId],
    );

    if (comandas.length === 0) return null;
    const comanda = comandas[0];

    let itens: any[] = [];
    try {
      itens = await AppDataSource.query(
        `SELECT pi.id, pi.quantidade, pi.preco_unitario,
                (pi.quantidade * pi.preco_unitario) AS valor_total,
                pi.ponto_carne, pi.observacao, prod.nome AS produto_nome
         FROM pedido_itens pi
         INNER JOIN pedidos p ON p.id = pi.pedido_id
         INNER JOIN produtos prod ON prod.id = pi.produto_id
         WHERE p.comanda_id = ?
         ORDER BY pi.id ASC`,
        [comandaId],
      );
    } catch {
      itens = await AppDataSource.query(
        `SELECT pi.id, pi.quantidade, pi.preco_unitario,
                (pi.quantidade * pi.preco_unitario) AS valor_total,
                pi.ponto_carne, pi.observacoes AS observacao, prod.nome AS produto_nome
         FROM pedido_itens pi
         INNER JOIN pedidos p ON p.id = pi.pedido_id
         INNER JOIN produtos prod ON prod.id = pi.produto_id
         WHERE p.comanda_id = ?
         ORDER BY pi.id ASC`,
        [comandaId],
      );
    }

    const taxaPercentual = Number(process.env.TAXA_SERVICO_PERCENTUAL) || 10;
    const subtotal = Number(comanda.subtotal) || 0;
    const taxaServico = Number(((subtotal * taxaPercentual) / 100).toFixed(2));
    const desconto = Number(comanda.desconto) || 0;
    const totalComTaxa = Math.max(0, Number((subtotal + taxaServico - desconto).toFixed(2)));
    const totalSemTaxa = Math.max(0, Number((subtotal - desconto).toFixed(2)));

    return {
      comanda,
      itens,
      subtotal,
      taxaServico,
      taxaPercentual,
      desconto,
      totalComTaxa,
      totalSemTaxa,
    };
  }

  // 2. Dados da Ordem de Produção (Cozinha ou Bar)
  async obterOrdemProducao(comandaId: number, setor?: 'COZINHA' | 'BAR') {
    const comandas = await AppDataSource.query(
      `SELECT c.id, c.tipo, m.numero AS mesa_numero, u.nome AS atendente_nome
       FROM comandas c
       LEFT JOIN mesas m ON m.id = c.mesa_id
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.id = ? LIMIT 1`,
      [comandaId],
    );

    if (comandas.length === 0) return null;

    let filtroCategoria = '';
    if (setor === 'BAR') {
      filtroCategoria = `AND (LOWER(cat.nome) LIKE '%bebida%' OR LOWER(cat.nome) LIKE '%bar%' OR LOWER(cat.nome) LIKE '%cerveja%' OR LOWER(cat.nome) LIKE '%suco%')`;
    } else if (setor === 'COZINHA') {
      filtroCategoria = `AND NOT (LOWER(cat.nome) LIKE '%bebida%' OR LOWER(cat.nome) LIKE '%bar%' OR LOWER(cat.nome) LIKE '%cerveja%' OR LOWER(cat.nome) LIKE '%suco%')`;
    }

    let itens: any[] = [];
    try {
      itens = await AppDataSource.query(
        `SELECT pi.id, pi.quantidade, pi.ponto_carne, pi.observacao, prod.nome AS produto_nome, cat.nome AS categoria_nome
         FROM pedido_itens pi
         INNER JOIN pedidos p ON p.id = pi.pedido_id
         INNER JOIN produtos prod ON prod.id = pi.produto_id
         INNER JOIN categorias cat ON cat.id = prod.categoria_id
         WHERE p.comanda_id = ? ${filtroCategoria}
         ORDER BY pi.id ASC`,
        [comandaId],
      );
    } catch {
      itens = await AppDataSource.query(
        `SELECT pi.id, pi.quantidade, pi.ponto_carne, pi.observacoes AS observacao, prod.nome AS produto_nome, cat.nome AS categoria_nome
         FROM pedido_itens pi
         INNER JOIN pedidos p ON p.id = pi.pedido_id
         INNER JOIN produtos prod ON prod.id = pi.produto_id
         INNER JOIN categorias cat ON cat.id = prod.categoria_id
         WHERE p.comanda_id = ? ${filtroCategoria}
         ORDER BY pi.id ASC`,
        [comandaId],
      );
    }

    return {
      comanda: comandas[0],
      itens,
      setor: setor || 'TODOS',
    };
  }
}