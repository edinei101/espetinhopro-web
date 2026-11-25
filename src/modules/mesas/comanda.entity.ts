import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('comandas')
export class Comanda {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'mesa_id', type: 'int', nullable: true })
  mesaId?: number | null;

  @Column({ name: 'atendente_id', type: 'int', nullable: true })
  atendenteId?: number | null;

  @Column({ type: 'varchar', length: 20, default: 'MESA' })
  tipo!: string;

  @Column({ name: 'nome_cliente', type: 'varchar', length: 100, nullable: true })
  nomeCliente?: string | null;

  @Column({ name: 'data_abertura', type: 'datetime', nullable: true })
  dataAbertura?: Date | null;

  @Column({ name: 'data_fechamento', type: 'datetime', nullable: true })
  dataFechamento?: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  subtotal!: number;

  @Column({ name: 'taxa_servico', type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  taxaServico!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  desconto!: number;

  @Column({ name: 'valor_total', type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  valorTotal!: number;

  @Column({ type: 'varchar', length: 25, default: 'ABERTA' })
  status!: string;

  @Column({ name: 'total_pago', type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  totalPago!: number;

  @Column({ name: 'valor_recebido', type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  valorRecebido!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  troco!: number;
}