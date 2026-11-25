import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('produtos')
export class Produto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId?: number | null;

  @Column({ type: 'varchar', length: 100 })
  nome!: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  preco!: number;

  @Column({ name: 'requer_ponto_carne', type: 'tinyint', default: 0 })
  requerPontoCarne!: number;

  @Column({ name: 'controla_estoque', type: 'tinyint', default: 0 })
  controlaEstoque!: number;

  @Column({ name: 'quantidade_estoque', type: 'int', default: 0 })
  quantidadeEstoque!: number;

  @Column({ name: 'estoque_minimo', type: 'int', default: 0 })
  estoqueMinimo!: number;

  @Column({ type: 'tinyint', default: 1 })
  ativo!: number;

  @Column({ name: 'permite_vinculo', type: 'tinyint', default: 0 })
  permiteVinculo!: number;

  @Column({ name: 'produto_vinculado_id', type: 'int', nullable: true })
  produtoVinculadoId?: number | null;
}