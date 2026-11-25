export class CriarItemEstoqueDto {
  nome: string;
  categoria_id?: number;
  preco?: number;
  quantidade_estoque: number;
  estoque_minimo?: number;
  descricao?: string;
}

export class MovimentarEstoqueDto {
  tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
  quantidade: number;
  motivo?: string;
  custo_unitario?: number;
}

export class AtualizarItemEstoqueDto {
  nome?: string;
  categoria_id?: number;
  preco?: number;
  estoque_minimo?: number;
  descricao?: string;
}