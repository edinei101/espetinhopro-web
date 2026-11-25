import { Injectable } from '@nestjs/common';
import { AppDataSource } from '../../config/database/typeorm.provider';

export interface MesaDTO {
  numero: number;
  nomeIdentificador?: string | null;
  ativo?: number;
}

export interface AdicionarItemMesaDTO {
  comandaId: number;
  produtoId: number;
  quantidade: number;
  pontoCarne?: string | null;
  observacao?: string | null;
  usuarioId: number;
}

@Injectable()
export class MesasService {
  // ==================== SALÃO DE MESAS ====================

  async listarPainel(): Promise<any[]> {
    const mesas = await AppDataSource.query(
      'SELECT * FROM mesas WHERE ativo = 1 AND status != "EXCLUIDA" ORDER BY numero ASC',
    );

    const comandas = await AppDataSource.query(
      `SELECT c.mesa_id, c.id AS comanda_id, c.valor_total, c.nome_cliente, u.nome AS atendente_nome
       FROM comandas c
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.tipo = 'MESA' AND c.status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO')`,
    );

    return mesas.map((m: any) => {
      const comandaAtiva = comandas.find((c: any) => c.mesa_id === m.id);
      return {
        ...m,
        comanda_id: comandaAtiva ? comandaAtiva.comanda_id : null,
        total: comandaAtiva ? Number(comandaAtiva.valor_total || 0) : 0,
        cliente: comandaAtiva ? comandaAtiva.nome_cliente : null,
        garcom: comandaAtiva ? comandaAtiva.atendente_nome : null,
      };
    });
  }

  async abrirComanda(mesaId: number, nomeCliente: string, atendenteId: number): Promise<number> {
    const idValido = atendenteId && Number(atendenteId) > 0 ? Number(atendenteId) : 1;

    const resultado = await AppDataSource.query(
      `INSERT INTO comandas (
         tipo, mesa_id, nome_cliente, atendente_id, data_abertura, status,
         subtotal, taxa_servico, desconto, valor_total, total_pago, valor_recebido, troco
       ) VALUES ('MESA', ?, ?, ?, NOW(), 'ABERTA', 0, 0, 0, 0, 0, 0, 0)`,
      [mesaId, nomeCliente, idValido],
    );

    await AppDataSource.query('UPDATE mesas SET status = "OCUPADA" WHERE id = ?', [mesaId]);
    return resultado.insertId;
  }

  async obterDetalhesComanda(comandaId: number) {
    const comandas = await AppDataSource.query(
      `SELECT c.*, m.numero AS mesa_numero, m.nome_identificador AS mesa_nome, u.nome AS garcom_nome
       FROM comandas c
       INNER JOIN mesas m ON m.id = c.mesa_id
       LEFT JOIN usuarios u ON u.id = c.atendente_id
       WHERE c.id = ? AND c.tipo = 'MESA' LIMIT 1`,
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
    const podeFecharConta =
      comandas[0].status === 'ABERTA' &&
      itens.length > 0 &&
      !temItensEmPreparo &&
      !temItensEmRascunho;

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

  // Reserva atômica de estoque ao adicionar item na comanda
  async adicionarItem(dados: AdicionarItemMesaDTO): Promise<void> {
    const { comandaId, produtoId, pontoCarne, observacao, usuarioId } = dados;
    const quantidade = Math.max(1, Number(dados.quantidade) || 1);
    const idUsuario = usuarioId && Number(usuarioId) > 0 ? Number(usuarioId) : 1;

    // 1. Consulta o produto atual no banco
    const prodRows = await AppDataSource.query(
      'SELECT id, nome, preco, categoria_id, quantidade_estoque FROM produtos WHERE id = ? AND ativo = 1 LIMIT 1',
      [produtoId],
    );

    if (!prodRows || prodRows.length === 0) {
      throw new Error('Produto inexistente ou inativo.');
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

    // 2. TRAVA ATÔMICA NO BANCO DE DADOS:
    // Só desconta se no exato milissegundo do comando o saldo continuar >= quantidade.
    // Impede que 2 garçons vendam o mesmo estoque simultaneamente.
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
      // Se ocorrer qualquer falha ao gravar o item na comanda, devolve o estoque reservado
      await AppDataSource.query(
        'UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id = ?',
        [quantidade, produtoId],
      );
      throw erroInsercao;
    }
  }

  // Devolve ao estoque quando o garçom retira o item da comanda (antes da cozinha)
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

    // Devolve imediatamente as unidades ao estoque para ficarem disponíveis para venda novamente
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

  // Confirma envio para Cozinha/Bar (o estoque já foi reservado e agora fica definitivamente baixado)
  async enviarProducao(comandaId: number): Promise<void> {
    await AppDataSource.query(
      `UPDATE pedidos 
       SET status_preparo = 'PENDENTE' 
       WHERE comanda_id = ? AND (status_preparo = 'RASCUNHO' OR status_preparo IS NULL)`,
      [comandaId],
    );
  }

  // Cancela a comanda (se ainda não foi para preparo) e devolve todos os itens reservados ao estoque
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

    // Busca todos os itens que estavam reservados nesta comanda
    const itensParaEstornar = await AppDataSource.query(
      `SELECT pi.id, pi.produto_id, pi.quantidade
       FROM pedido_itens pi
       INNER JOIN pedidos p ON p.id = pi.pedido_id
       WHERE p.comanda_id = ?`,
      [comandaId],
    );

    // Devolve cada item ao estoque e limpa os itens da comanda cancelada
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

    const comandaRows = await AppDataSource.query(
      'SELECT mesa_id FROM comandas WHERE id = ? LIMIT 1',
      [comandaId],
    );

    await AppDataSource.query(
      `UPDATE comandas 
       SET status = 'CANCELADA', subtotal = 0, valor_total = 0, data_fechamento = NOW() 
       WHERE id = ?`,
      [comandaId],
    );

    if (comandaRows.length > 0 && comandaRows[0].mesa_id) {
      await AppDataSource.query('UPDATE mesas SET status = "LIVRE" WHERE id = ?', [
        comandaRows[0].mesa_id,
      ]);
    }
  }

  async solicitarFechamento(comandaId: number): Promise<void> {
    const pedidosNaoProntos = await AppDataSource.query(
      `SELECT id FROM pedidos 
       WHERE comanda_id = ? AND status_preparo IN ('PENDENTE', 'EM_PREPARO', 'RASCUNHO') LIMIT 1`,
      [comandaId],
    );

    if (pedidosNaoProntos.length > 0) {
      throw new Error('Não é possível solicitar fechamento com pedidos em preparo ou rascunho.');
    }

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

  // ==================== CADASTRO / GESTÃO DE MESAS ====================

  async listarTodas(): Promise<any[]> {
    return AppDataSource.query(
      `SELECT m.*,
              (SELECT COUNT(*) 
               FROM comandas c 
               WHERE c.mesa_id = m.id AND c.status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO')
              ) AS comandas_ativas
       FROM mesas m
       WHERE m.status != 'EXCLUIDA'
       ORDER BY m.numero ASC`,
    );
  }

  async listarMesasCadastro() {
    return this.listarTodas();
  }

  async criarMesa(dados: MesaDTO): Promise<{ reativada: boolean }> {
    if (!dados.numero || dados.numero <= 0) {
      throw new Error('Número de mesa inválido.');
    }

    const mesaExistente = await AppDataSource.query(
      'SELECT id, status, ativo FROM mesas WHERE numero = ? LIMIT 1',
      [dados.numero],
    );

    if (mesaExistente.length > 0) {
      const mesa = mesaExistente[0];
      if (mesa.status === 'EXCLUIDA' || mesa.ativo === 0) {
        await AppDataSource.query(
          `UPDATE mesas 
           SET nome_identificador = ?, status = 'LIVRE', ativo = 1 
           WHERE id = ?`,
          [dados.nomeIdentificador || null, mesa.id],
        );
        return { reativada: true };
      } else {
        throw new Error(`A Mesa número ${dados.numero} já está cadastrada.`);
      }
    }

    await AppDataSource.query(
      `INSERT INTO mesas (numero, nome_identificador, status, ativo) 
       VALUES (?, ?, 'LIVRE', 1)`,
      [dados.numero, dados.nomeIdentificador || null],
    );

    return { reativada: false };
  }

  async atualizarMesa(id: number, dados: MesaDTO): Promise<void> {
    if (!dados.numero || dados.numero <= 0) {
      throw new Error('Número de mesa inválido.');
    }

    if (dados.ativo === 0) {
      const comandasAbertas = await AppDataSource.query(
        "SELECT id FROM comandas WHERE mesa_id = ? AND status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO') LIMIT 1",
        [id],
      );
      if (comandasAbertas.length > 0) {
        throw new Error('Não é possível desativar uma mesa em atendimento.');
      }
    }

    const duplicada = await AppDataSource.query(
      'SELECT id FROM mesas WHERE numero = ? AND id != ? LIMIT 1',
      [dados.numero, id],
    );
    if (duplicada.length > 0) {
      throw new Error(`Já existe outra mesa com o número ${dados.numero}.`);
    }

    await AppDataSource.query(
      `UPDATE mesas 
       SET numero = ?, nome_identificador = ?, ativo = ? 
       WHERE id = ?`,
      [dados.numero, dados.nomeIdentificador || null, dados.ativo ?? 1, id],
    );
  }

  async excluirMesa(id: number): Promise<void> {
    const comandasAbertas = await AppDataSource.query(
      "SELECT id FROM comandas WHERE mesa_id = ? AND status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO') LIMIT 1",
      [id],
    );

    if (comandasAbertas.length > 0) {
      throw new Error('Não é possível excluir uma mesa em atendimento.');
    }

    await AppDataSource.query(
      "UPDATE mesas SET status = 'EXCLUIDA', ativo = 0 WHERE id = ?",
      [id],
    );
  }
}