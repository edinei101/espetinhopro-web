import { Injectable } from '@nestjs/common';
import { AppDataSource } from '../../config/database/typeorm.provider';

@Injectable()
export class BarService {
  // 1. Listar pedidos e itens pendentes para o bar (apenas Bebidas - categoria_id = 3)
  async listarFilaBar(): Promise<any[]> {
    const pedidos = await AppDataSource.query(
      `SELECT DISTINCT
         p.id AS pedido_id,
         p.data_criacao,
         p.status_preparo,
         c.id AS comanda_id,
         c.tipo AS comanda_tipo,
         c.nome_cliente,
         m.numero AS mesa_numero,
         u.nome AS garcom_nome
       FROM pedidos p
       INNER JOIN comandas c ON c.id = p.comanda_id
       INNER JOIN pedido_itens pi ON pi.pedido_id = p.id
       INNER JOIN produtos prod ON prod.id = pi.produto_id
       LEFT JOIN mesas m ON m.id = c.mesa_id
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.status_preparo IN ('PENDENTE', 'EM_PREPARO')
         AND c.status NOT IN ('CANCELADA')
         AND prod.categoria_id = 3
       ORDER BY p.data_criacao ASC`,
    );

    let itens: any[] = [];
    if (pedidos.length > 0) {
      const pedidoIds = pedidos.map((p: any) => p.pedido_id);

      try {
        itens = await AppDataSource.query(
          `SELECT 
             pi.id,
             pi.pedido_id,
             pi.quantidade,
             pi.observacao,
             prod.nome AS produto_nome,
             cat.nome AS categoria_nome
           FROM pedido_itens pi
           INNER JOIN produtos prod ON prod.id = pi.produto_id
           INNER JOIN categorias cat ON cat.id = prod.categoria_id
           WHERE pi.pedido_id IN (?)
             AND prod.categoria_id = 3
           ORDER BY pi.id ASC`,
          [pedidoIds],
        );
      } catch {
        itens = await AppDataSource.query(
          `SELECT 
             pi.id,
             pi.pedido_id,
             pi.quantidade,
             pi.observacoes AS observacao,
             prod.nome AS produto_nome,
             cat.nome AS categoria_nome
           FROM pedido_itens pi
           INNER JOIN produtos prod ON prod.id = pi.produto_id
           INNER JOIN categorias cat ON cat.id = prod.categoria_id
           WHERE pi.pedido_id IN (?)
             AND prod.categoria_id = 3
           ORDER BY pi.id ASC`,
          [pedidoIds],
        );
      }
    }

    return pedidos
      .map((pedido: any) => ({
        ...pedido,
        itens: itens.filter((i: any) => i.pedido_id === pedido.pedido_id),
      }))
      .filter((p: any) => p.itens.length > 0);
  }

  // 2. Iniciar preparo / separação das bebidas
  async iniciarPreparo(pedidoId: number): Promise<void> {
    await AppDataSource.query(
      "UPDATE pedidos SET status_preparo = 'EM_PREPARO' WHERE id = ?",
      [pedidoId],
    );
  }

  // 3. Concluir / Liberar bebidas
  async concluirPreparo(pedidoId: number): Promise<void> {
    await AppDataSource.query(
      "UPDATE pedidos SET status_preparo = 'PRONTO' WHERE id = ?",
      [pedidoId],
    );
  }
}