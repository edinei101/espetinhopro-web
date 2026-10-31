import { RowDataPacket } from 'mysql2';

export interface Produto extends RowDataPacket {
  id: number;
  categoria_id: number;
  categoria_nome?: string;
  nome: string;
  descricao: string | null;
  preco: number;
  requer_ponto_carne: number;
  controla_estoque: number;
  quantidade_estoque: number;
  ativo: number;
  permite_vinculo: number;
  produto_vinculado_id: number | null;
}