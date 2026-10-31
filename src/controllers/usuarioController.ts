import { Request, Response } from 'express';
import { usuarioService } from '../services/usuarioService';

function checarEhSuperAdmin(req: Request): boolean {
  const loginEnv = (
    process.env.ADMIN_USER || 
    process.env.ADMIN_ROOT_LOGIN || 
    process.env.SUPER_ADMIN_LOGIN || 
    'admin'
  ).toLowerCase();

  const usuarioLogado = (req as any).session?.usuario || (req as any).usuario;
  const loginSessao = (usuarioLogado?.email || usuarioLogado?.login || '').toLowerCase();

  return Boolean(loginSessao && loginSessao === loginEnv);
}

class UsuarioController {
  // 1. Listar usuários
  async listar(req: Request, res: Response): Promise<void> {
    try {
      const mostrarTodos = req.query.status === 'todos';
      const mensagem = req.query.msg ? String(req.query.msg) : null;
      const erro = req.query.erro ? String(req.query.erro) : null;

      const { usuarios, perfis } = await usuarioService.listar(mostrarTodos);
      const ehSuperAdmin = checarEhSuperAdmin(req);

      res.render('usuarios/listar', {
        titulo: 'Equipe & Acessos',
        moduloAtual: 'equipe',
        usuarios,
        perfis,
        mostrarTodos,
        ehSuperAdmin,
        mensagem,
        erro
      });
    } catch (error) {
      console.error('Erro ao listar equipe:', error);
      res.status(500).send('Erro interno ao listar colaboradores.');
    }
  }

  // 2. Cadastrar novo colaborador
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const { nome, email, perfil_id } = req.body;
      const perfilIdNum = Number(perfil_id);

      if (!nome || !email || !perfilIdNum) {
        return res.redirect('/usuarios?erro=Preencha todos os campos obrigatórios.');
      }

      await usuarioService.criar({
        nome,
        email,
        perfilId: perfilIdNum,
        ehSuperAdmin: checarEhSuperAdmin(req),
        acessoSalao: req.body.acesso_salao === 'on' || req.body.acesso_salao === '1' ? 1 : 0,
        acessoCaixa: req.body.acesso_caixa === 'on' || req.body.acesso_caixa === '1' ? 1 : 0,
        acessoCozinha: req.body.acesso_cozinha === 'on' || req.body.acesso_cozinha === '1' ? 1 : 0,
        acessoEstoque: req.body.acesso_estoque === 'on' || req.body.acesso_estoque === '1' ? 1 : 0,
        acessoRelatorios: req.body.acesso_relatorios === 'on' || req.body.acesso_relatorios === '1' ? 1 : 0,
        acessoConfiguracoes: req.body.acesso_configuracoes === 'on' || req.body.acesso_configuracoes === '1' ? 1 : 0
      });

      res.redirect('/usuarios?msg=Colaborador cadastrado com sucesso! Senha padrão: usuario123');
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      res.redirect(`/usuarios?erro=${encodeURIComponent(error.message || 'Erro interno ao cadastrar colaborador.')}`);
    }
  }

  // 3. Atualizar colaborador existente
  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const { nome, email, perfil_id, nova_senha } = req.body;
      const perfilIdNum = Number(perfil_id);

      if (!nome || !email || !perfilIdNum) {
        return res.redirect('/usuarios?erro=Preencha todos os campos obrigatórios na edição.');
      }

      await usuarioService.atualizar({
        id,
        nome,
        email,
        perfilId: perfilIdNum,
        ehSuperAdmin: checarEhSuperAdmin(req),
        novaSenha: nova_senha,
        ativo: req.body.ativo === 'on' || req.body.ativo === '1' ? 1 : 0,
        acessoSalao: req.body.acesso_salao === 'on' || req.body.acesso_salao === '1' ? 1 : 0,
        acessoCaixa: req.body.acesso_caixa === 'on' || req.body.acesso_caixa === '1' ? 1 : 0,
        acessoCozinha: req.body.acesso_cozinha === 'on' || req.body.acesso_cozinha === '1' ? 1 : 0,
        acessoEstoque: req.body.acesso_estoque === 'on' || req.body.acesso_estoque === '1' ? 1 : 0,
        acessoRelatorios: req.body.acesso_relatorios === 'on' || req.body.acesso_relatorios === '1' ? 1 : 0,
        acessoConfiguracoes: req.body.acesso_configuracoes === 'on' || req.body.acesso_configuracoes === '1' ? 1 : 0
      });

      res.redirect('/usuarios?msg=Dados do colaborador atualizados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      res.redirect(`/usuarios?erro=${encodeURIComponent(error.message || 'Erro interno ao atualizar colaborador.')}`);
    }
  }

  // 4. Resetar senha para o padrão
  async resetarSenha(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      await usuarioService.resetarSenha(id);
      res.redirect('/usuarios?msg=Senha redefinida para usuario123 com troca obrigatória no próximo login.');
    } catch (error: any) {
      console.error('Erro ao resetar senha:', error);
      res.redirect(`/usuarios?erro=${encodeURIComponent(error.message || 'Erro ao resetar senha.')}`);
    }
  }

  // 5. Troca obrigatória de senha no primeiro acesso
  async trocarSenhaPrimeiroAcesso(req: Request, res: Response): Promise<void> {
    try {
      const idUsuario = Number((req as any).session?.idUsuario || (req as any).session?.usuario?.id);
      const { nova_senha, confirmar_senha } = req.body;

      if (!idUsuario) {
        return res.redirect('/login');
      }

      await usuarioService.trocarSenhaPrimeiroAcesso({
        usuarioId: idUsuario,
        novaSenha: nova_senha,
        confirmarSenha: confirmar_senha
      });

      // Atualiza o estado da sessão ativa para fechar o modal
      if ((req as any).session) {
        (req as any).session.primeiro_acesso = 0;
        if ((req as any).session.usuario) {
          (req as any).session.usuario.primeiro_acesso = 0;
        }
      }

      res.redirect('/mesas?msg=Senha alterada com sucesso! Bem-vindo(a) ao sistema.');
    } catch (error: any) {
      console.error('Erro ao trocar senha no primeiro acesso:', error);
      res.redirect(`/mesas?erro=${encodeURIComponent(error.message || 'Erro interno ao atualizar senha.')}`);
    }
  }

  // 6. Exclusão Segura (Soft Delete)
  async excluir(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      await usuarioService.excluir(id);
      res.redirect('/usuarios?msg=Colaborador desativado da equipe com sucesso!');
    } catch (error: any) {
      console.error('Erro ao desativar usuário:', error);
      res.redirect(`/usuarios?erro=${encodeURIComponent(error.message || 'Erro interno ao desativar colaborador.')}`);
    }
  }

  // 7. Reativar colaborador
  async reativar(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      await usuarioService.reativar(id);
      res.redirect('/usuarios?status=todos&msg=Colaborador reativado na equipe com sucesso!');
    } catch (error: any) {
      console.error('Erro ao reativar usuário:', error);
      res.redirect(`/usuarios?status=todos&erro=${encodeURIComponent(error.message || 'Erro interno ao reativar colaborador.')}`);
    }
  }
}

export const usuarioController = new UsuarioController();
export default usuarioController;