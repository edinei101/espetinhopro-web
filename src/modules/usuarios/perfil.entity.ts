import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('perfis')
export class Perfil {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  nome!: string;
}