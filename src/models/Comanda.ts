import { RowDataPacket } from 'mysql2';

export interface Comanda extends RowDataPacket {
  id: number;
  mesa_id: number | null;
  atendente_id: number | null;
  tipo: 'MESA' | 'BALCAO';
  nome_cliente: string | null;
  data_abertura: Date;
  data_fechamento: Date | null;
  subtotal: number;
  taxa_servico: number;
  desconto: number;
  valor_total: number;
  status: 'ABERTA' | 'AGUARDANDO_PAGAMENTO' | 'PAGA' | 'CANCELADA';
  total_pago: number;
  valor_recebido: number;
  troco: number;
}