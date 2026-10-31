import bcrypt from 'bcryptjs';
import db from '../config/database';

export interface DadosSessaoUsuario {
  id: number;
  nome: string;
  email: string;
  perfil_id: number;
  perfil_nome: string;
  primeiro_acesso: number;
  ativo: number;
  isAdmin: boolean;
  permissoes: {
    salao: boolean;
    caixa: boolean;
    cozinha: boolean;
    estoque: boolean;
    relatorios: boolean;
    configuracoes: boolean;
  };
}

export class AutenticacaoService {
  async autenticar(login: string, senha: string): Promise<DadosSessaoUsuario> {
    const loginLimpo = login.trim().toLowerCase();

    // 1. Validação do Super Administrador Master (.env)
    const adminUserEnv = (process.env.ADMIN_USER || 'admin').toLowerCase();
    const adminPassEnv = process.env.ADMIN_PASS;

    if (loginLimpo === adminUserEnv && senha === adminPassEnv) {
      return {
        id: 0,
        nome: 'Administrador Master',
        email: process.env.ADMIN_USER || 'admin',
        perfil_id: 1,
        perfil_nome: 'Administrador',
        primeiro_acesso: 0,
        ativo: 1,
        isAdmin: true,
        permissoes: {
          salao: true,
          caixa: true,
          cozinha: true,
          estoque: true,
          relatorios: true,
          configuracoes: true
        }
      };
    }

    // 2. Busca do colaborador no banco de dados
    const [rows]: any = await db.query(
      `SELECT u.*, p.nome AS perfil_nome 
       FROM usuarios u
       INNER JOIN perfis p ON p.id = u.perfil_id
       WHERE LOWER(u.email) = ? AND u.ativo = 1 
       LIMIT 1`,
      [loginLimpo]
    );

    const usuario = rows[0];

    if (!usuario) {
      throw new Error('Usuário ou senha inválidos.');
    }

    // 3. Regra de negócio: bloqueio para cargos de apoio exclusivo a rateio
    const perfilNome = (usuario.perfil_nome || '').toLowerCase();
    if (perfilNome.includes('entregador') || perfilNome.includes('zelador')) {
      throw new Error('Este cargo não possui permissão de acesso ao sistema operacional.');
    }

    // 4. Validação da senha (bcrypt ou texto legado)
    let senhaValida = false;
    if (usuario.senha && usuario.senha.startsWith('$2')) {
      senhaValida = await bcrypt.compare(senha, usuario.senha);
    } else {
      senhaValida = usuario.senha === senha;
    }

    if (!senhaValida) {
      throw new Error('Usuário ou senha inválidos.');
    }

    // 5. Define nível de privilégio e consolida permissões
    const ehAdmin = perfilNome.includes('administrador') || perfilNome.includes('gerente');

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil_id: usuario.perfil_id,
      perfil_nome: usuario.perfil_nome,
      primeiro_acesso: Number(usuario.primeiro_acesso || 0),
      ativo: usuario.ativo,
      isAdmin: ehAdmin,
      permissoes: {
        salao: Boolean(usuario.acesso_salao),
        caixa: Boolean(usuario.acesso_caixa),
        cozinha: Boolean(usuario.acesso_cozinha),
        estoque: Boolean(usuario.acesso_estoque),
        relatorios: Boolean(usuario.acesso_relatorios),
        configuracoes: Boolean(usuario.acesso_configuracoes)
      }
    };
  }
}

export const autenticacaoService = new AutenticacaoService();