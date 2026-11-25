export class CriarProdutoDto {
  nome: string;
  categoria_id: number;
  preco: number;
  descricao?: string;
  ativo?: number;
  permite_ponto_carne?: number;
}

export class AtualizarProdutoDto {
  nome?: string;
  categoria_id?: number;
  preco?: number;
  descricao?: string;
  ativo?: number;
  permite_ponto_carne?: number;
}