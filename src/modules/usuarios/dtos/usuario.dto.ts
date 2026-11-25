export class AtualizarUsuarioDto {
  nome?: string;
  email?: string;
  perfil_id?: number | string;
  ativo?: number | string;
  nova_senha?: string;
  acesso_salao?: any;
  acesso_caixa?: any;
  acesso_cozinha?: any;
  acesso_estoque?: any;
  acesso_relatorios?: any;
  acesso_configuracoes?: any;
}

export class CriarUsuarioDto {
  nome: string;
  email: string;
  perfil_id: number | string;
  acesso_salao?: any;
  acesso_caixa?: any;
  acesso_cozinha?: any;
  acesso_estoque?: any;
  acesso_relatorios?: any;
  acesso_configuracoes?: any;
}

export class TrocarSenhaPrimeiroAcessoDto {
  senha_atual: string;
  nova_senha: string;
  confirmacao_senha: string;
}
