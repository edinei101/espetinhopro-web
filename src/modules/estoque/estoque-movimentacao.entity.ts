import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('estoque_movimentacoes')
export class EstoqueMovimentacao {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'produto_id', type: 'int' })
  produtoId!: number;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId?: number | null;

  @Column({
    name: 'tipo_movimentacao',
    type: 'enum',
    enum: ['ENTRADA', 'SAIDA', 'PERDA', 'AJUSTE', 'VENDA', 'CANCELAMENTO_VENDA'],
  })
  tipoMovimentacao!: string;

  @Column({ type: 'int' })
  quantidade!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo?: string | null;

  @Column({ name: 'data_movimentacao', type: 'datetime', nullable: true })
  dataMovimentacao?: Date | null;
}