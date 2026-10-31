import bcrypt from 'bcryptjs';
import db from '../config/database';

export interface CriarUsuarioDTO {
  nome: string;
  email: string;
  perfilId: number;
  ehSuperAdmin: boolean;
  acessoSalao: number;
  acessoCaixa: number;
  acessoCozinha: number;
  acessoEstoque: number;
  acessoRelatorios: number;
  acessoConfiguracoes: number;
}

export interface AtualizarUsuarioDTO {
  id: number;
  nome: string;
  email: string;
  perfilId: number;
  ehSuperAdmin: boolean;
  novaSenha?: string | null;
  ativo: number;
  acessoSalao: number;
  acessoCaixa: number;
  acessoCozinha: number;
  acessoEstoque: number;
  acessoRelatorios: number;
  acessoConfiguracoes: number;
}

export interface TrocarSenhaPrimeiroAcessoDTO {
  usuarioId: number;
  novaSenha?: string;
  confirmarSenha?: string;
}

export class UsuarioService {
  // 1. Listar usuários com ordenação dupla (Cargo/Função A-Z e Nome A-Z) e perfis disponíveis
  async listar(mostrarTodos: boolean) {
    const sqlFiltro = mostrarTodos ? '' : 'WHERE u.ativo = 1';

    const [usuarios]: any = await db.query(
      `SELECT u.*, p.nome AS perfil_nome
       FROM usuarios u
       INNER JOIN perfis p ON p.id = u.perfil_id
       ${sqlFiltro}
       ORDER BY p.nome ASC, u.nome ASC`
    );

    const [perfis]: any = await db.query('SELECT * FROM perfis ORDER BY nome ASC');

    return { usuarios, perfis };
  }

  // 2. Cadastrar novo colaborador com senha padrão e regras de segurança
  async criar(dados: CriarUsuarioDTO): Promise<number> {
    const emailLimpo = dados.email.trim().toLowerCase();

    // Valida perfil
    const [perfilEncontrado]: any = await db.query(
      'SELECT id, nome FROM perfis WHERE id = ?',
      [dados.perfilId]
    );

    if (perfilEncontrado.length === 0) {
      throw new Error('Perfil selecionado inválido.');
    }

    const nomePerfil = perfilEncontrado[0].nome.toLowerCase();

    // Regra de segurança: Somente Super Admin do .env cadastra Gerente/Administrador
    if ((nomePerfil.includes('administrador') || nomePerfil.includes('gerente')) && !dados.ehSuperAdmin) {
      throw new Error('Somente o Administrador Geral (.env) pode cadastrar gerentes.');
    }

    // Regra de Login Único: não pode existir no banco nem ativo nem inativo
    const [usuarioExistente]: any = await db.query(
      'SELECT id FROM usuarios WHERE LOWER(email) = ? LIMIT 1',
      [emailLimpo]
    );

    if (usuarioExistente.length > 0) {
      throw new Error('Este login já pertence a um colaborador (ativo ou inativo). Escolha outro.');
    }

    // Senha inicial padrão criptografada: usuario123
    const saltRounds = 10;
    const senhaPadraoHash = await bcrypt.hash('usuario123', saltRounds);

    // Cargos sem acesso ao sistema: Entregador e Zelador
    const semAcessoAoPainel = nomePerfil.includes('entregador') || nomePerfil.includes('zelador');

    const acessoSalao = semAcessoAoPainel ? 0 : dados.acessoSalao;
    const acessoCaixa = semAcessoAoPainel ? 0 : dados.acessoCaixa;
    const acessoCozinha = semAcessoAoPainel ? 0 : dados.acessoCozinha;
    const acessoEstoque = semAcessoAoPainel ? 0 : dados.acessoEstoque;
    const acessoRelatorios = semAcessoAoPainel ? 0 : dados.acessoRelatorios;
    const acessoConfiguracoes = semAcessoAoPainel ? 0 : dados.acessoConfiguracoes;

    const [resultado]: any = await db.query(
      `INSERT INTO usuarios (
         perfil_id, nome, email, senha, ativo, data_cadastro,
         acesso_salao, acesso_caixa, acesso_cozinha, acesso_estoque,
         acesso_relatorios, acesso_configuracoes, primeiro_acesso
       ) VALUES (?, ?, ?, ?, 1, NOW(), ?, ?, ?, ?, ?, ?, 1)`,
      [
        dados.perfilId,
        dados.nome.trim(),
        emailLimpo,
        senhaPadraoHash,
        acessoSalao,
        acessoCaixa,
        acessoCozinha,
        acessoEstoque,
        acessoRelatorios,
        acessoConfiguracoes
      ]
    );

    return resultado.insertId;
  }

  // 3. Atualizar dados do colaborador existente
  async atualizar(dados: AtualizarUsuarioDTO): Promise<void> {
    const emailLimpo = dados.email.trim().toLowerCase();

    // Checa duplicidade de login com outro usuário
    const [duplicado]: any = await db.query(
      'SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ? LIMIT 1',
      [emailLimpo, dados.id]
    );

    if (duplicado.length > 0) {
      throw new Error('Este login já está sendo utilizado por outro cadastro.');
    }

    // Valida perfil
    const [perfilEncontrado]: any = await db.query(
      'SELECT id, nome FROM perfis WHERE id = ?',
      [dados.perfilId]
    );

    if (perfilEncontrado.length === 0) {
      throw new Error('Perfil selecionado inválido.');
    }

    const nomePerfil = perfilEncontrado[0].nome.toLowerCase();

    if ((nomePerfil.includes('administrador') || nomePerfil.includes('gerente')) && !dados.ehSuperAdmin) {
      throw new Error('Apenas o Administrador Geral (.env) pode definir o perfil Gerente.');
    }

    const semAcesso = nomePerfil.includes('entregador') || nomePerfil.includes('zelador');

    const acessoSalao = semAcesso ? 0 : dados.acessoSalao;
    const acessoCaixa = semAcesso ? 0 : dados.acessoCaixa;
    const acessoCozinha = semAcesso ? 0 : dados.acessoCozinha;
    const acessoEstoque = semAcesso ? 0 : dados.acessoEstoque;
    const acessoRelatorios = semAcesso ? 0 : dados.acessoRelatorios;
    const acessoConfiguracoes = semAcesso ? 0 : dados.acessoConfiguracoes;

    if (dados.novaSenha && dados.novaSenha.trim() !== '') {
      const hashSenha = await bcrypt.hash(dados.novaSenha.trim(), 10);
      await db.query(
        `UPDATE usuarios 
         SET nome = ?, email = ?, perfil_id = ?, senha = ?, primeiro_acesso = 0,
             acesso_salao = ?, acesso_caixa = ?, acesso_cozinha = ?, acesso_estoque = ?,
             acesso_relatorios = ?, acesso_configuracoes = ?, ativo = ?
         WHERE id = ?`,
        [
          dados.nome.trim(), emailLimpo, dados.perfilId, hashSenha,
          acessoSalao, acessoCaixa, acessoCozinha, acessoEstoque,
          acessoRelatorios, acessoConfiguracoes, dados.ativo, dados.id
        ]
      );
    } else {
      await db.query(
        `UPDATE usuarios 
         SET nome = ?, email = ?, perfil_id = ?,
             acesso_salao = ?, acesso_caixa = ?, acesso_cozinha = ?, acesso_estoque = ?,
             acesso_relatorios = ?, acesso_configuracoes = ?, ativo = ?
         WHERE id = ?`,
        [
          dados.nome.trim(), emailLimpo, dados.perfilId,
          acessoSalao, acessoCaixa, acessoCozinha, acessoEstoque,
          acessoRelatorios, acessoConfiguracoes, dados.ativo, dados.id
        ]
      );
    }
  }

  // 4. Resetar senha para o padrão com obrigatoriedade de troca
  async resetarSenha(id: number): Promise<void> {
    const senhaPadraoHash = await bcrypt.hash('usuario123', 10);

    await db.query(
      'UPDATE usuarios SET senha = ?, primeiro_acesso = 1 WHERE id = ?',
      [senhaPadraoHash, id]
    );
  }

  // 5. Troca de senha obrigatória no primeiro acesso
  async trocarSenhaPrimeiroAcesso(dados: TrocarSenhaPrimeiroAcessoDTO): Promise<void> {
    const { usuarioId, novaSenha, confirmarSenha } = dados;

    if (!novaSenha || novaSenha.trim().length < 4) {
      throw new Error('A nova senha deve ter no mínimo 4 caracteres.');
    }

    if (novaSenha !== confirmarSenha) {
      throw new Error('A confirmação de senha não confere com a nova senha.');
    }

    if (novaSenha === 'usuario123') {
      throw new Error('A nova senha não pode ser igual à senha inicial padrão.');
    }

    const saltRounds = 10;
    const novaSenhaHash = await bcrypt.hash(novaSenha.trim(), saltRounds);

    await db.query(
      'UPDATE usuarios SET senha = ?, primeiro_acesso = 0 WHERE id = ?',
      [novaSenhaHash, usuarioId]
    );
  }

  // 6. Soft Delete seguro
  async excluir(id: number): Promise<void> {
    await db.query('UPDATE usuarios SET ativo = 0 WHERE id = ?', [id]);
  }

  // 7. Reativar colaborador
  async reativar(id: number): Promise<void> {
    await db.query('UPDATE usuarios SET ativo = 1 WHERE id = ?', [id]);
  }
}

export const usuarioService = new UsuarioService();