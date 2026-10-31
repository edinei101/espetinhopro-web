import { RowDataPacket } from 'mysql2';

export interface Usuario extends RowDataPacket {
  id: number;
  nome: string;
  login: string;
  senha?: string;
  perfil_id: number;
  ativo: number;
  acesso_salao?: number;
  acesso_caixa?: number;
  acesso_cozinha?: number;
  acesso_estoque?: number;
  acesso_relatorios?: number;
  acesso_configuracoes?: number;
}