export class AbrirMesaDto {
  mesa_id?: number;
  mesaId?: number;
  nome_cliente?: string;
  nomeCliente?: string;
}

export class AdicionarItemMesaDto {
  produto_id?: number;
  produtoId?: number;
  quantidade?: number;
  observacao?: string;
  ponto_carne?: string;
  pontoCarne?: string;
}

export class SalvarMesaDto {
  numero: number | string;
  capacidade?: number | string;
}