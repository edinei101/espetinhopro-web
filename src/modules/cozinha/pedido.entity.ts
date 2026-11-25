import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('pedidos')
export class Pedido {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'comanda_id', type: 'int', nullable: true })
  comandaId?: number | null;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId?: number | null;

  @Column({ name: 'data_criacao', type: 'datetime', nullable: true })
  dataCriacao?: Date | null;

  @Column({ name: 'status_preparo', type: 'varchar', length: 20, default: 'PENDENTE' })
  statusPreparo!: string;
}