import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('pedido_itens')
export class PedidoItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'pedido_id', type: 'int', nullable: true })
  pedidoId?: number | null;

  @Column({ name: 'produto_id', type: 'int', nullable: true })
  produtoId?: number | null;

  @Column({ type: 'int', default: 1 })
  quantidade!: number;

  @Column({ name: 'preco_unitario', type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  precoUnitario!: number;

  @Column({ name: 'ponto_carne', type: 'varchar', length: 30, nullable: true })
  pontoCarne?: string | null;

  @Column({ type: 'text', nullable: true })
  observacao?: string | null;
}