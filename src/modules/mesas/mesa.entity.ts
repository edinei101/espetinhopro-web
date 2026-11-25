import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('mesas')
export class Mesa {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', unique: true })
  numero!: number;

  @Column({ name: 'nome_identificador', type: 'varchar', length: 50, nullable: true })
  nomeIdentificador?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'LIVRE' })
  status!: string;

  @Column({ type: 'tinyint', default: 1 })
  ativo!: number;
}