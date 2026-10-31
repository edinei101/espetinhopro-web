import { RowDataPacket } from 'mysql2';

export interface Mesa extends RowDataPacket {
  id: number;
  numero: number;
  status: 'LIVRE' | 'OCUPADA' | 'RESERVADA' | 'EXCLUIDA';
  nome_identificador?: string | null;
  ativo: number;
}