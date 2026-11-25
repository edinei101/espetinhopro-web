export class AbrirComandaBalcaoDto {
  nome_cliente?: string;
  nomeCliente?: string;
}

export class AdicionarItemBalcaoDto {
  produto_id: number | string;
  produtoId?: number | string;
  quantidade?: number | string;
  ponto_carne?: string | null;
  pontoCarne?: string | null;
  observacao?: string | null;
}