import { Injectable } from '@nestjs/common';
import { AppDataSource } from '../../config/database/typeorm.provider';

export interface AdicionarItemBalcaoDTO {
  comandaId: number;
  produtoId: number;
  quantidade: number;
  pontoCarne?: string | null;
  observacao?: string | null;
  usuarioId: number;
}

@Injectable()
export class BalcaoService {
  // 1. Listar comandas ativas do balcão
  async listarComandas(): Promise<any[]> {
    return AppDataSource.query(
      `SELECT c.*, u.nome AS atendente_nome 
       FROM comandas c
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.tipo = 'BALCAO' AND c.status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO')
       ORDER BY c.data_abertura DESC`,
    );
  }

  // 2. Abrir nova comanda de balcão
  async abrirComanda(nomeCliente: string, atendenteId: number): Promise<number> {
    const idValido = atendenteId && Number(atendenteId) > 0 ? Number(atendenteId) : 1;

    const resultado = await AppDataSource.query(
      `INSERT INTO comandas (
         tipo, nome_cliente, atendente_id, data_abertura, status, 
         subtotal, taxa_servico, desconto, valor_total, total_pago, valor_recebido, troco
       ) VALUES ('BALCAO', ?, ?, NOW(), 'ABERTA', 0, 0, 0, 0, 0, 0, 0)`,
      [nomeCliente, idValido],
    );

    return resultado.insertId;
  }

  // 3. Obter detalhes da comanda, itens e produtos para a tela
  async obterDetalhesComanda(comandaId: number) {
    const comandas = await AppDataSource.query(
      `SELECT c.*, u.nome AS atendente_nome 
       FROM comandas c
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.id = ? AND c.tipo = 'BALCAO' LIMIT 1`,
      [comandaId],
    );

    if (!comandas || comandas.length === 0) {
      return null;
    }

    let itens: any[] = [];
    try {
      itens = await AppDataSource.query(
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
        [comandaId],
      );
    } catch {
      itens = await AppDataSource.query(
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
        [comandaId],
      );
    }

    const jaEnviadoParaProducao = itens.some(
      (item: any) => item.status_preparo && item.status_preparo !== 'RASCUNHO',
    );
    const temItensEmPreparo = itens.some(
      (item: any) => item.status_preparo === 'PENDENTE' || item.status_preparo === 'EM_PREPARO',
    );
    const temItensEmRascunho = itens.some(
      (item: any) => item.status_preparo === 'RASCUNHO',
    );
    const podeFecharConta = itens.length > 0 && !temItensEmPreparo && !temItensEmRascunho;

    const produtos = await AppDataSource.query(
      `SELECT p.*, c.nome AS categoria_nome 
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.ativo = 1
       ORDER BY c.id ASC, p.nome ASC`,
    );

    const produtosPorCategoria = {
      espetinhos: produtos.filter((p: any) => Number(p.categoria_id) === 1),
      acompanhamentos: produtos.filter((p: any) => Number(p.categoria_id) === 2),
      bebidas: produtos.filter((p: any) => Number(p.categoria_id) === 3),
      checkout: produtos.filter(
        (p: any) =>
          Number(p.categoria_id) === 4 ||
          (p.categoria_id !== 1 && p.categoria_id !== 2 && p.categoria_id !== 3),
      ),
    };

    return {
      comanda: comandas[0],
      itens,
      produtos,
      produtosPorCategoria,
      jaEnviadoParaProducao,
      temItensEmPreparo,
      temItensEmRascunho,
      podeFecharConta,
    };
  }

  // 4. Lançar item com reserva atômica de estoque no banco
  async adicionarItem(dados: AdicionarItemBalcaoDTO): Promise<void> {
    const { comandaId, produtoId, pontoCarne, observacao, usuarioId } = dados;
    const quantidade = Math.max(1, Number(dados.quantidade) || 1);
    const idUsuario = usuarioId && Number(usuarioId) > 0 ? Number(usuarioId) : 1;

    const prodRows = await AppDataSource.query(
      'SELECT id, nome, preco, categoria_id, quantidade_estoque FROM produtos WHERE id = ? AND ativo = 1 LIMIT 1',
      [produtoId],
    );

    if (!prodRows || prodRows.length === 0) {
      throw new Error('Produto não encontrado ou inativo.');
    }

    const produto = prodRows[0];
    const saldoAntes = Number(produto.quantidade_estoque) || 0;

    if (saldoAntes <= 0) {
      throw new Error(`O produto "${produto.nome}" está esgotado no estoque (0 un. disponíveis).`);
    }

    if (quantidade > saldoAntes) {
      throw new Error(
        `Estoque insuficiente para "${produto.nome}". Você tentou adicionar ${quantidade} un., mas só restam ${saldoAntes} un. disponíveis.`,
      );
    }

    // TRAVA ATÔMICA: Reserva imediatamente no banco apenas se houver saldo suficiente
    const updateEstoque: any = await AppDataSource.query(
      `UPDATE produtos 
       SET quantidade_estoque = quantidade_estoque - ?, controla_estoque = 1 
       WHERE id = ? AND quantidade_estoque >= ?`,
      [quantidade, produtoId, quantidade],
    );

    if (!updateEstoque || updateEstoque.affectedRows === 0) {
      const [recheck] = await AppDataSource.query(
        'SELECT quantidade_estoque FROM produtos WHERE id = ? LIMIT 1',
        [produtoId],
      );
      const dispAgora = Number(recheck?.quantidade_estoque) || 0;
      throw new Error(
        `Outro atendente acabou de reservar "${produto.nome}". Saldo disponível agora: ${dispAgora} un.`,
      );
    }

    const precoUnitario = Number(produto.preco);
    const catId = Number(produto.categoria_id);
    const ehCheckout = catId === 4;
    const ehBebida = catId === 3;

    try {
      let pedidoId: number;

      if (ehCheckout) {
        const pedidosCheckoutExistente = await AppDataSource.query(
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

        if (pedidosCheckoutExistente.length > 0) {
          pedidoId = pedidosCheckoutExistente[0].id;
        } else {
          const novoPedido = await AppDataSource.query(
            `INSERT INTO pedidos (comanda_id, usuario_id, data_criacao, status_preparo)
             VALUES (?, ?, NOW(), 'PRONTO')`,
            [comandaId, idUsuario],
          );
          pedidoId = novoPedido.insertId;
        }
      } else {
        const pedidosCandidatos = await AppDataSource.query(
          `SELECT p.id 
           FROM pedidos p
           INNER JOIN pedido_itens pi ON pi.pedido_id = p.id
           INNER JOIN produtos prod ON prod.id = pi.produto_id
           WHERE p.comanda_id = ? 
             AND p.status_preparo = 'RASCUNHO'
             AND (${ehBebida ? 'prod.categoria_id = 3' : 'prod.categoria_id NOT IN (3, 4)'})
           ORDER BY p.id DESC LIMIT 1`,
          [comandaId],
        );

        if (pedidosCandidatos.length > 0) {
          pedidoId = pedidosCandidatos[0].id;
        } else {
          const novoPedido = await AppDataSource.query(
            `INSERT INTO pedidos (comanda_id, usuario_id, data_criacao, status_preparo)
             VALUES (?, ?, NOW(), 'RASCUNHO')`,
            [comandaId, idUsuario],
          );
          pedidoId = novoPedido.insertId;
        }
      }

      try {
        await AppDataSource.query(
          `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, ponto_carne, observacao)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pedidoId, produtoId, quantidade, precoUnitario, pontoCarne || null, observacao || null],
        );
      } catch {
        await AppDataSource.query(
          `INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, ponto_carne, observacoes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pedidoId, produtoId, quantidade, precoUnitario, pontoCarne || null, observacao || null],
        );
      }

      await this.recalcularTotaisComanda(comandaId);
    } catch (erroInsercao) {
      await AppDataSource.query(
        'UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id = ?',
        [quantidade, produtoId],
      );
      throw erroInsercao;
    }
  }

  // 5. Remover item do balcão e devolver saldo reservado ao estoque
  async removerItem(comandaId: number, itemId: number): Promise<void> {
    const itemCheck = await AppDataSource.query(
      `SELECT ped.status_preparo, pi.pedido_id, pi.produto_id, pi.quantidade, prod.categoria_id
       FROM pedido_itens pi 
       INNER JOIN pedidos ped ON ped.id = pi.pedido_id 
       INNER JOIN produtos prod ON prod.id = pi.produto_id
       WHERE pi.id = ? AND ped.comanda_id = ? LIMIT 1`,
      [itemId, comandaId],
    );

    if (itemCheck.length === 0) return;

    const item = itemCheck[0];
    const status = item.status_preparo;
    const catId = Number(item.categoria_id);

    if (status !== 'RASCUNHO' && catId !== 4) {
      throw new Error('Não é possível remover itens já enviados para produção.');
    }

    const pedidoId = item.pedido_id;
    const qtdDevolver = Number(item.quantidade) || 0;
    const prodIdDevolver = Number(item.produto_id);

    const deleteRes: any = await AppDataSource.query('DELETE FROM pedido_itens WHERE id = ?', [itemId]);

    // Devolve imediatamente ao estoque para ficar disponível novamente
    if (deleteRes && deleteRes.affectedRows > 0 && qtdDevolver > 0 && prodIdDevolver > 0) {
      await AppDataSource.query(
        'UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id = ?',
        [qtdDevolver, prodIdDevolver],
      );
    }

    if (pedidoId) {
      const resto = await AppDataSource.query(
        'SELECT COUNT(*) as total FROM pedido_itens WHERE pedido_id = ?',
        [pedidoId],
      );
      if (Number(resto[0].total) === 0) {
        await AppDataSource.query('DELETE FROM pedidos WHERE id = ?', [pedidoId]);
      }
    }

    await this.recalcularTotaisComanda(comandaId);
  }

  // 6. Enviar pedidos para produção (estoque permanece definitivamente baixado)
  async enviarProducao(comandaId: number): Promise<void> {
    await AppDataSource.query(
      `UPDATE pedidos 
       SET status_preparo = 'PENDENTE' 
       WHERE comanda_id = ? AND (status_preparo = 'RASCUNHO' OR status_preparo IS NULL)`,
      [comandaId],
    );
  }

  // 7. Cancelar comanda do balcão e devolver itens em rascunho ao estoque
  async cancelarComanda(comandaId: number): Promise<void> {
    const pedidosEnviados = await AppDataSource.query(
      `SELECT p.id FROM pedidos p
       INNER JOIN pedido_itens pi ON pi.pedido_id = p.id
       INNER JOIN produtos prod ON prod.id = pi.produto_id
       WHERE p.comanda_id = ? 
         AND p.status_preparo NOT IN ('RASCUNHO')
         AND prod.categoria_id != 4
       LIMIT 1`,
      [comandaId],
    );

    if (pedidosEnviados.length > 0) {
      throw new Error('Não é permitido cancelar comanda com pedidos em preparo ou entregues.');
    }

    const itensParaEstornar = await AppDataSource.query(
      `SELECT pi.id, pi.produto_id, pi.quantidade
       FROM pedido_itens pi
       INNER JOIN pedidos p ON p.id = pi.pedido_id
       WHERE p.comanda_id = ?`,
      [comandaId],
    );

    for (const item of itensParaEstornar) {
      const qtd = Number(item.quantidade) || 0;
      if (qtd > 0 && item.produto_id) {
        await AppDataSource.query(
          'UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id = ?',
          [qtd, item.produto_id],
        );
      }
      await AppDataSource.query('DELETE FROM pedido_itens WHERE id = ?', [item.id]);
    }

    await AppDataSource.query(
      `UPDATE comandas 
       SET status = 'CANCELADA', subtotal = 0, valor_total = 0, data_fechamento = NOW() 
       WHERE id = ?`,
      [comandaId],
    );
  }

  async solicitarFechamento(comandaId: number): Promise<void> {
    const itensComanda = await AppDataSource.query(
      `SELECT pi.id 
       FROM pedido_itens pi
       INNER JOIN pedidos p ON p.id = pi.pedido_id
       WHERE p.comanda_id = ? LIMIT 1`,
      [comandaId],
    );

    if (itensComanda.length === 0) {
      throw new Error('Não é possível fechar uma comanda de balcão sem nenhum item lançado.');
    }

    await AppDataSource.query(
      `UPDATE pedidos 
       SET status_preparo = 'PRONTO' 
       WHERE comanda_id = ? AND status_preparo = 'RASCUNHO'`,
      [comandaId],
    );

    await this.recalcularTotaisComanda(comandaId);

    await AppDataSource.query(
      `UPDATE comandas 
       SET status = 'AGUARDANDO_PAGAMENTO' 
       WHERE id = ?`,
      [comandaId],
    );
  }

  private async recalcularTotaisComanda(comandaId: number): Promise<void> {
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
}