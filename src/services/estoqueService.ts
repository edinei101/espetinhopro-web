import db from '../config/database';

export interface CriarProdutoEstoqueDTO {
  categoria_id: number;
  nome: string;
  descricao?: string | null;
  preco: number;
  controla_estoque: number;
  quantidade_estoque: number;
  estoque_minimo?: number;
  usuarioId: number | null;
}

export interface AtualizarProdutoEstoqueDTO {
  categoria_id: number;
  nome: string;
  descricao?: string | null;
  preco: number;
  controla_estoque: number;
  estoque_minimo?: number;
}

export interface MovimentarEstoqueDTO {
  tipo_movimentacao: string; // 'ENTRADA', 'SAIDA', 'PERDA', 'AJUSTE'
  quantidade: number;
  motivo?: string | null;
  usuarioId: number | null;
}

export class EstoqueService {
  // 1. Listagem completa e alertas de saldo
  async listar() {
    const [produtos]: any = await db.query(
      `SELECT p.*, c.nome AS categoria_nome
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.ativo = 1
       ORDER BY (p.quantidade_estoque <= 0) DESC, p.nome ASC`
    );

    // Alerta preventivo se o saldo for menor ou igual a 5 unidades ou zerado
    const produtosAlerta = produtos.filter(
      (p: any) => p.controla_estoque === 1 && Number(p.quantidade_estoque || 0) <= 5
    );

    const [categorias]: any = await db.query(
      'SELECT * FROM categorias WHERE ativo = 1 ORDER BY nome ASC'
    );

    return { produtos, produtosAlerta, categorias };
  }

  // 2. Criação de produto com saldo inicial seguro
  async criar(dados: CriarProdutoEstoqueDTO): Promise<number> {
    const [resultado]: any = await db.query(
      `INSERT INTO produtos (
         categoria_id, nome, descricao, preco, requer_ponto,
         controla_estoque, quantidade_estoque, ativo
       ) VALUES (?, ?, ?, ?, 0, ?, ?, 1)`,
      [
        dados.categoria_id,
        dados.nome.trim(),
        dados.descricao || null,
        dados.preco,
        dados.controla_estoque,
        dados.quantidade_estoque
      ]
    );

    const novoProdutoId = resultado.insertId;

    // Registra entrada inicial nas movimentações caso saldo inicial > 0
    if (dados.quantidade_estoque > 0 && dados.controla_estoque === 1) {
      await db.query(
        `INSERT INTO estoque_movimentacoes (
           produto_id, usuario_id, tipo_movimento, quantidade, motivo, data_movimento
         ) VALUES (?, ?, 'ENTRADA', ?, 'Saldo inicial no cadastro de produto', NOW())`,
        [novoProdutoId, dados.usuarioId, dados.quantidade_estoque]
      );
    }

    return novoProdutoId;
  }

  // 3. Atualização de dados cadastrais
  async atualizar(id: number, dados: AtualizarProdutoEstoqueDTO): Promise<void> {
    await db.query(
      `UPDATE produtos 
       SET nome = ?, categoria_id = ?, preco = ?, controla_estoque = ?, descricao = ?
       WHERE id = ?`,
      [
        dados.nome.trim(),
        dados.categoria_id,
        dados.preco,
        dados.controla_estoque,
        dados.descricao || null,
        id
      ]
    );
  }

  // 4. Lançamento e recálculo de movimentações (Entrada / Saída / Perda / Ajuste)
  async movimentar(id: number, dados: MovimentarEstoqueDTO): Promise<void> {
    const [prodRows]: any = await db.query(
      'SELECT quantidade_estoque, nome, controla_estoque FROM produtos WHERE id = ? LIMIT 1',
      [id]
    );

    if (prodRows.length === 0) {
      throw new Error('Produto não encontrado.');
    }

    const produto = prodRows[0];
    const estoqueAtual = Number(produto.quantidade_estoque) || 0;
    let novoEstoque = estoqueAtual;
    let qtdRegistrada = dados.quantidade;

    if (dados.tipo_movimentacao === 'ENTRADA') {
      if (dados.quantidade <= 0) {
        throw new Error('Informe uma quantidade válida para entrada.');
      }
      novoEstoque = estoqueAtual + dados.quantidade;
    } else if (dados.tipo_movimentacao === 'SAIDA' || dados.tipo_movimentacao === 'PERDA') {
      if (dados.quantidade <= 0) {
        throw new Error('Informe uma quantidade válida para saída/perda.');
      }
      if (dados.quantidade > estoqueAtual) {
        throw new Error(`Quantidade informada (${dados.quantidade}) é maior que o saldo em estoque (${estoqueAtual}).`);
      }
      novoEstoque = estoqueAtual - dados.quantidade;
    } else if (dados.tipo_movimentacao === 'AJUSTE') {
      novoEstoque = dados.quantidade;
      qtdRegistrada = Math.abs(novoEstoque - estoqueAtual);
    } else {
      throw new Error('Tipo de movimentação inválido.');
    }

    // Atualiza o saldo em produtos
    await db.query('UPDATE produtos SET quantidade_estoque = ? WHERE id = ?', [novoEstoque, id]);

    // Registra a trilha de auditoria em estoque_movimentacoes
    await db.query(
      `INSERT INTO estoque_movimentacoes (
         produto_id, usuario_id, tipo_movimento, quantidade, motivo, data_movimento
       ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        id,
        dados.usuarioId,
        dados.tipo_movimentacao,
        qtdRegistrada,
        dados.motivo ? dados.motivo.trim() : `Ajuste manual (${dados.tipo_movimentacao})`
      ]
    );
  }

  // 5. Exclusão segura com trava rígida de saldo
  async excluir(id: number): Promise<void> {
    const [prodRows]: any = await db.query(
      'SELECT nome, quantidade_estoque FROM produtos WHERE id = ? LIMIT 1',
      [id]
    );

    if (prodRows.length === 0) {
      throw new Error('Produto não encontrado.');
    }

    const produto = prodRows[0];
    const estoque = Number(produto.quantidade_estoque) || 0;

    if (estoque > 0) {
      throw new Error(`Não é permitido excluir "${produto.nome}" porque ele ainda possui ${estoque} unidade(s) em estoque. Zere o estoque antes de excluir.`);
    }

    // Soft delete seguro
    await db.query('UPDATE produtos SET ativo = 0 WHERE id = ?', [id]);
  }
}

export const estoqueService = new EstoqueService();