import db from '../config/database';
import { Comanda } from '../models/Comanda';
import { Produto } from '../models/Produto';

export interface AdicionarItemBalcaoDTO {
  comandaId: number;
  produtoId: number;
  quantidade: number;
  pontoCarne?: string | null;
  observacao?: string | null;
  usuarioId: number;
}

export class BalcaoService {
  // 1. Listar comandas ativas do balcão
  async listarComandas(): Promise<Comanda[]> {
    const [comandas] = await db.query<Comanda[]>(
      `SELECT c.*, u.nome AS atendente_nome 
       FROM comandas c
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.tipo = 'BALCAO' AND c.status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO')
       ORDER BY c.data_abertura DESC`
    );
    return comandas;
  }

  // 2. Abrir nova comanda de balcão
  async abrirComanda(nomeCliente: string, atendenteId: number): Promise<number> {
    const [resultado]: any = await db.query(
      `INSERT INTO comandas (
         tipo, nome_cliente, atendente_id, data_abertura, status, 
         subtotal, taxa_servico, desconto, valor_total, total_pago, valor_recebido, troco
       ) VALUES ('BALCAO', ?, ?, NOW(), 'ABERTA', 0, 0, 0, 0, 0, 0, 0)`,
      [nomeCliente, atendenteId]
    );
    return resultado.insertId;
  }

  // 3. Obter detalhes da comanda, itens e produtos para a tela
  async obterDetalhesComanda(comandaId: number) {
    const [comandas] = await db.query<Comanda[]>(
      `SELECT c.*, u.nome AS atendente_nome 
       FROM comandas c
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.id = ? AND c.tipo = 'BALCAO' LIMIT 1`,
      [comandaId]
    );

    if (comandas.length === 0) {
      return null;
    }

    let itens: any[] = [];
    try {
      const [itensRows]: any = await db.query(
        `SELECT 
           pi.id,
           pi.pedido_id,
           pi.quantidade,
           pi.preco_unitario,
           (pi.quantidade * pi.preco_unitario) AS valor_total,
           pi.ponto_carne,
           pi.observacao,
           p.nome AS produto_nome,
           p.categoria_id,
           ped.status_preparo
         FROM pedido_itens pi
         INNER JOIN pedidos ped ON ped.id = pi.pedido_id
         INNER JOIN produtos p ON p.id = pi.produto_id
         WHERE ped.comanda_id = ?
         ORDER BY pi.id ASC`,
        [comandaId]
      );
      itens = itensRows;
    } catch {
      // Fallback para coluna observacoes no plural
      const [itensRowsAlt]: any = await db.query(
        `SELECT 
           pi.id,
           pi.pedido_id,
           pi.quantidade,
           pi.preco_unitario,
           (pi.quantidade * pi.preco_unitario) AS valor_total,
           pi.ponto_carne,
           pi.observacoes AS observacao,
           p.nome AS produto_nome,
           p.categoria_id,
           ped.status_preparo
         FROM pedido_itens pi
         INNER JOIN pedidos ped ON ped.id = pi.pedido_id
         INNER JOIN produtos p ON p.id = pi.produto_id
         WHERE ped.comanda_id = ?
         ORDER BY pi.id ASC`,
        [comandaId]
      );
      itens = itensRowsAlt;
    }

    const jaEnviadoParaProducao = itens.some(
      (item: any) => item.status_preparo && item.status_preparo !== 'RASCUNHO'
    );

    const temItensEmPreparo = itens.some(
      (item: any) => item.status_preparo === 'PENDENTE' || item.status_preparo === 'EM_PREPARO'
    );

    const temItensEmRascunho = itens.some(
      (item: any) => item.status_preparo === 'RASCUNHO'
    );

    const podeFecharConta = itens.length > 0 && !temItensEmPreparo && !temItensEmRascunho;

    const [produtos] = await db.query<Produto[]>(
      `SELECT p.*, c.nome AS categoria_nome 
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.ativo = 1
       ORDER BY c.id ASC, p.nome ASC`
    );

    const produtosPorCategoria = {
      espetinhos: produtos.filter(p => Number(p.categoria_id) === 1),
      acompanhamentos: produtos.filter(p => Number(p.categoria_id) === 2),
      bebidas: produtos.filter(p => Number(p.categoria_id) === 3),
      checkout: produtos.filter(p => Number(p.categoria_id) === 4 || (p.categoria_id !== 1 && p.categoria_id !== 2 && p.categoria_id !== 3))
    };

    return {
      comanda: comandas[0],
      itens,
      produtos,
      produtosPorCategoria,
      jaEnviadoParaProducao,
      temItensEmPreparo,
      temItensEmRascunho,
      podeFecharConta
    };
  }

  // 4. Lançar item com separação automática em lotes de preparo
  async adicionarItem(dados: AdicionarItemBalcaoDTO): Promise<void> {
    const { comandaId, produtoId, quantidade, pontoCarne, observacao, usuarioId } = dados;

    const [prodRows]: any = await db.query(
      'SELECT preco, categoria_id FROM produtos WHERE id = ? LIMIT 1',
      [produtoId]
    );

    if (prodRows.length === 0) {
      throw new Error('Produto não encontrado.');
    }

    const precoUnitario = Number(prodRows[0].preco);
    const catId = Number(prodRows[0].categoria_id);
    const ehCheckout = catId === 4;
    const ehBebida = catId === 3;

    let pedidoId: number;

    if (ehCheckout) {
      const [pedidosCheckoutExistente]: any = await db.query(
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

      if (pedidosCheckoutExistente.length > 0) {
        pedidoId = pedidosCheckoutExistente[0].id;
      } else {
        const [novoPedido]: any = await db.query(
          `INSERT INTO pedidos (comanda_id, usuario_id, data_criacao, status_preparo)
           VALUES (?, ?, NOW(), 'PRONTO')`,
          [comandaId, usuarioId]
        );
        pedidoId = novoPedido.insertId;
      }
    } else {
      const [pedidosCandidatos]: any = await db.query(
        `SELECT p.id 
         FROM pedidos p
         INNER JOIN pedido_itens pi ON pi.pedido_id = p.id
         INNER JOIN produtos prod ON prod.id = pi.produto_id
         WHERE p.comanda_id = ? 
           AND p.status_preparo = 'RASCUNHO'
           AND (${ehBebida ? 'prod.categoria_id = 3' : 'prod.categoria_id NOT IN (3, 4)'})
         ORDER BY p.id DESC LIMIT 1`,
        [comandaId]
      );

      if (pedidosCandidatos.length > 0) {
        pedidoId = pedidosCandidatos[0].id;
      } else {
        const [novoPedido]: any = await db.query(
          `INSERT INTO pedidos (comanda_id, usuario_id, data_criacao, status_preparo)
           VALUES (?, ?, NOW(), 'RASCUNHO')`,
          [comandaId, usuarioId]
        );
        pedidoId = novoPedido.insertId;
      }
    }

    try {
      await db.query(
        `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, ponto_carne, observacao)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pedidoId, produtoId, quantidade, precoUnitario, pontoCarne || null, observacao || null]
      );
    } catch {
      await db.query(
        `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, ponto_carne, observacoes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pedidoId, produtoId, quantidade, precoUnitario, pontoCarne || null, observacao || null]
      );
    }

    await this.recalcularTotaisComanda(comandaId);
  }

  // 5. Remover item do balcão
  async removerItem(comandaId: number, itemId: number): Promise<void> {
    const [itemCheck]: any = await db.query(
      `SELECT ped.status_preparo, pi.pedido_id, prod.categoria_id
       FROM pedido_itens pi 
       INNER JOIN pedidos ped ON ped.id = pi.pedido_id 
       INNER JOIN produtos prod ON prod.id = pi.produto_id
       WHERE pi.id = ? AND ped.comanda_id = ? LIMIT 1`,
      [itemId, comandaId]
    );

    if (itemCheck.length > 0) {
      const status = itemCheck[0].status_preparo;
      const catId = Number(itemCheck[0].categoria_id);

      if (status !== 'RASCUNHO' && catId !== 4) {
        throw new Error('Não é possível remover itens já enviados para produção.');
      }
    }

    const pedidoId = itemCheck[0]?.pedido_id;

    await db.query('DELETE FROM pedido_itens WHERE id = ?', [itemId]);

    if (pedidoId) {
      const [resto]: any = await db.query(
        'SELECT COUNT(*) as total FROM pedido_itens WHERE pedido_id = ?',
        [pedidoId]
      );
      if (resto[0].total === 0) {
        await db.query('DELETE FROM pedidos WHERE id = ?', [pedidoId]);
      }
    }

    await this.recalcularTotaisComanda(comandaId);
  }

  // 6. Enviar pedidos para produção
  async enviarProducao(comandaId: number): Promise<void> {
    await db.query(
      `UPDATE pedidos 
       SET status_preparo = 'PENDENTE' 
       WHERE comanda_id = ? AND (status_preparo = 'RASCUNHO' OR status_preparo IS NULL)`,
      [comandaId]
    );
  }

  // 7. Cancelar comanda do balcão
  async cancelarComanda(comandaId: number): Promise<void> {
    const [pedidosEnviados]: any = await db.query(
      `SELECT p.id FROM pedidos p
       INNER JOIN pedido_itens pi ON pi.pedido_id = p.id
       INNER JOIN produtos prod ON prod.id = pi.produto_id
       WHERE p.comanda_id = ? 
         AND p.status_preparo NOT IN ('RASCUNHO')
         AND prod.categoria_id != 4
       LIMIT 1`,
      [comandaId]
    );

    if (pedidosEnviados.length > 0) {
      throw new Error('Não é permitido cancelar comanda com pedidos em preparo ou entregues.');
    }

    await db.query(
      `UPDATE comandas 
       SET status = 'CANCELADA', subtotal = 0, valor_total = 0, data_fechamento = NOW() 
       WHERE id = ?`,
      [comandaId]
    );
  }

  // 8. Encerrar balcão (enviar para cobrança no caixa)
  async solicitarFechamento(comandaId: number): Promise<void> {
    const [pedidosNaoProntos]: any = await db.query(
      `SELECT id FROM pedidos 
       WHERE comanda_id = ? AND status_preparo IN ('PENDENTE', 'EM_PREPARO', 'RASCUNHO') LIMIT 1`,
      [comandaId]
    );

    if (pedidosNaoProntos.length > 0) {
      throw new Error('Não é possível solicitar fechamento com itens em preparo ou rascunho.');
    }

    await db.query(
      `UPDATE comandas 
       SET status = 'AGUARDANDO_PAGAMENTO' 
       WHERE id = ?`,
      [comandaId]
    );
  }

  // Helper interno de recálculo dos totais da comanda
  private async recalcularTotaisComanda(comandaId: number): Promise<void> {
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
}

export const balcaoService = new BalcaoService();