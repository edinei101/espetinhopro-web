import { Injectable } from '@nestjs/common';
import { AppDataSource } from '../../config/database/typeorm.provider';

export interface ItemCardapioDTO {
  categoriaId: number;
  nome: string;
  descricao?: string | null;
  preco: number;
  controlaEstoque: number;
  quantidadeEstoque: number;
  requerPontoCarne: number;
  acompanhamentos?: string | string[] | number | number[];
}

@Injectable()
export class CardapioService {
  // 1. Listar itens por categoria e carregar acompanhamentos vinculados
  async listarPorCategoria(categoriaAtiva: number) {
    const produtos = await AppDataSource.query(
      `SELECT p.*, c.nome AS categoria_nome
       FROM produtos p
       INNER JOIN categorias c ON c.id = p.categoria_id
       WHERE p.ativo = 1 AND p.categoria_id = ?
       ORDER BY p.nome ASC`,
      [categoriaAtiva],
    );

    // Se for Espetinhos (Categoria 1), busca os acompanhamentos vinculados
    if (categoriaAtiva === 1 && produtos.length > 0) {
      for (const prod of produtos) {
        let acompVinculados: any[] = [];
        try {
          acompVinculados = await AppDataSource.query(
            `SELECT p.id, p.nome
             FROM produtos_acompanhamentos_padrao pap
             INNER JOIN produtos p ON p.id = pap.acompanhamento_id
             WHERE pap.produto_principal_id = ? AND p.ativo = 1`,
            [prod.id],
          );
        } catch {
          try {
            acompVinculados = await AppDataSource.query(
              `SELECT p.id, p.nome
               FROM acompanhamentos_padrao ap
               INNER JOIN produtos p ON p.id = ap.acompanhamento_id
               WHERE ap.produto_pai_id = ? AND p.ativo = 1`,
              [prod.id],
            );
          } catch {
            acompVinculados = [];
          }
        }
        prod.acompanhamentos = acompVinculados;
      }
    }

    // Busca todos os acompanhamentos ativos (Categoria 2) para checkboxes
    const todosAcompanhamentos = await AppDataSource.query(
      `SELECT id, nome, preco 
       FROM produtos 
       WHERE categoria_id = 2 AND ativo = 1 
       ORDER BY nome ASC`,
    );

    return { produtos, todosAcompanhamentos };
  }

  // 2. Criar novo item no cardápio
  async criarItem(dados: ItemCardapioDTO): Promise<number> {
    let resProd: any;
    try {
      resProd = await AppDataSource.query(
        `INSERT INTO produtos (
           categoria_id, nome, descricao, preco, requer_ponto_carne, 
           controla_estoque, quantidade_estoque, ativo
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          dados.categoriaId,
          dados.nome,
          dados.descricao || null,
          dados.preco,
          dados.requerPontoCarne,
          dados.controlaEstoque,
          dados.quantidadeEstoque,
        ],
      );
    } catch {
      resProd = await AppDataSource.query(
        `INSERT INTO produtos (
           categoria_id, nome, descricao, preco, requer_ponto, 
           controla_estoque, quantidade_estoque, ativo
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          dados.categoriaId,
          dados.nome,
          dados.descricao || null,
          dados.preco,
          dados.requerPontoCarne,
          dados.controlaEstoque,
          dados.quantidadeEstoque,
        ],
      );
    }

    const novoProdutoId = resProd.insertId;

    if (dados.categoriaId === 1 && dados.acompanhamentos) {
      await this.salvarAcompanhamentos(novoProdutoId, dados.acompanhamentos);
    }

    return novoProdutoId;
  }

  // 3. Atualizar item existente
  async atualizarItem(id: number, dados: ItemCardapioDTO): Promise<void> {
    try {
      await AppDataSource.query(
        `UPDATE produtos 
         SET nome = ?, descricao = ?, preco = ?, requer_ponto_carne = ?, 
             controla_estoque = ?, quantidade_estoque = ?
         WHERE id = ?`,
        [
          dados.nome,
          dados.descricao || null,
          dados.preco,
          dados.requerPontoCarne,
          dados.controlaEstoque,
          dados.quantidadeEstoque,
          id,
        ],
      );
    } catch {
      await AppDataSource.query(
        `UPDATE produtos 
         SET nome = ?, descricao = ?, preco = ?, requer_ponto = ?, 
             controla_estoque = ?, quantidade_estoque = ?
         WHERE id = ?`,
        [
          dados.nome,
          dados.descricao || null,
          dados.preco,
          dados.requerPontoCarne,
          dados.controlaEstoque,
          dados.quantidadeEstoque,
          id,
        ],
      );
    }

    if (dados.categoriaId === 1) {
      await this.salvarAcompanhamentos(id, dados.acompanhamentos, true);
    }
  }

  // 4. Soft delete seguro
  async excluirItem(id: number): Promise<void> {
    await AppDataSource.query('UPDATE produtos SET ativo = 0 WHERE id = ?', [id]);
  }

  // Salvar vínculos de acompanhamentos com compatibilidade de tabelas
  private async salvarAcompanhamentos(
    produtoId: number,
    acompanhamentos: any,
    limparAnteriores = false,
  ): Promise<void> {
    if (limparAnteriores) {
      try {
        await AppDataSource.query(
          'DELETE FROM produtos_acompanhamentos_padrao WHERE produto_principal_id = ?',
          [produtoId],
        );
      } catch {
        try {
          await AppDataSource.query(
            'DELETE FROM acompanhamentos_padrao WHERE produto_pai_id = ?',
            [produtoId],
          );
        } catch {}
      }
    }

    if (!acompanhamentos) return;

    let acompIds = acompanhamentos;
    if (!Array.isArray(acompIds)) {
      acompIds = [acompIds];
    }

    for (const acompId of acompIds) {
      const idAcomp = Number(acompId);
      if (!idAcomp) continue;

      try {
        await AppDataSource.query(
          `INSERT INTO produtos_acompanhamentos_padrao (produto_principal_id, acompanhamento_id, quantidade)
           VALUES (?, ?, 1)`,
          [produtoId, idAcomp],
        );
      } catch {
        try {
          await AppDataSource.query(
            `INSERT INTO acompanhamentos_padrao (produto_pai_id, acompanhamento_id, quantidade)
             VALUES (?, ?, 1)`,
            [produtoId, idAcomp],
          );
        } catch {}
      }
    }
  }
}