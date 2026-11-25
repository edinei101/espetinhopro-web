export class AbrirCaixaDto {
  valor_inicial: number | string;
}

export class FecharCaixaDto {
  valor_final?: number | string;
  saldo_conferido?: number | string;
  modalidade_rateio?: string;
  total_taxa_turno?: number | string;
  funcionarios_rateio?: number[] | string[] | number | string;
  observacoes?: string;
}

export class AdicionarItemCheckoutDto {
  produto_id: number | string;
  quantidade: number | string;
  observacao?: string;
}

export class ProcessarPagamentoDto {
  forma_pagamento: string;
  aplicar_taxa?: string | boolean;
  desconto?: number | string;
  valor_abater?: number | string;
  valor_pago?: number | string;
  dinheiro_entregue?: number | string;
  taxa_servico?: number | string;
}

export class ItemCarrinhoDto {
  produto_id: number | string;
  quantidade: number | string;
}

export class VendaRapidaDto {
  produto_id?: number | string;
  quantidade?: number | string;
  itens?: ItemCarrinhoDto[];
  forma_pagamento: string;
  desconto?: number | string;
  valor_recebido?: number | string;
  observacao?: string;
}