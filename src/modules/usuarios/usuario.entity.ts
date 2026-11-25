import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'perfil_id', type: 'int', nullable: true })
  perfilId?: number | null;

  @Column({ type: 'varchar', length: 100 })
  nome!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  senha!: string;

  @Column({ type: 'tinyint', default: 1 })
  ativo!: number;

  @Column({ name: 'data_cadastro', type: 'datetime', nullable: true })
  dataCadastro?: Date | null;

  @Column({ name: 'acesso_salao', type: 'tinyint', default: 0 })
  acessoSalao!: number;

  @Column({ name: 'acesso_caixa', type: 'tinyint', default: 0 })
  acessoCaixa!: number;

  @Column({ name: 'acesso_cozinha', type: 'tinyint', default: 0 })
  acessoCozinha!: number;

  @Column({ name: 'acesso_estoque', type: 'tinyint', default: 0 })
  acessoEstoque!: number;

  @Column({ name: 'acesso_relatorios', type: 'tinyint', default: 0 })
  acessoRelatorios!: number;

  @Column({ name: 'acesso_configuracoes', type: 'tinyint', default: 0 })
  acessoConfiguracoes!: number;

  @Column({ name: 'primeiro_acesso', type: 'tinyint', default: 1 })
  primeiroAcesso!: number;
}