import { Request, Response } from 'express';
import { autenticacaoService } from '../services/autenticacaoService';

class AutenticacaoController {
  // Exibe a tela de login
  exibirLogin(_req: Request, res: Response): void {
    res.render('autenticacao/login', {
      titulo: 'Login',
      erro: null
    });
  }

  // Processa a validação de credenciais
  async processarLogin(req: Request, res: Response): Promise<void> {
    try {
      const { login, senha } = req.body;

      if (!login || !senha) {
        return res.render('autenticacao/login', {
          titulo: 'Login',
          erro: 'Preencha o login e a senha.'
        });
      }

      const usuarioAutenticado = await autenticacaoService.autenticar(login, senha);

      // Preenchimento de sessão
      req.session.logado = true;
      req.session.isAdmin = usuarioAutenticado.isAdmin;
      req.session.idUsuario = usuarioAutenticado.id;
      req.session.nomeUsuario = usuarioAutenticado.nome;
      req.session.primeiro_acesso = usuarioAutenticado.primeiro_acesso;

      req.session.usuario = {
        id: usuarioAutenticado.id,
        nome: usuarioAutenticado.nome,
        email: usuarioAutenticado.email,
        perfil_id: usuarioAutenticado.perfil_id,
        perfil_nome: usuarioAutenticado.perfil_nome,
        primeiro_acesso: usuarioAutenticado.primeiro_acesso,
        ativo: usuarioAutenticado.ativo
      };

      req.session.acesso_salao = usuarioAutenticado.permissoes.salao;
      req.session.acesso_caixa = usuarioAutenticado.permissoes.caixa;
      req.session.acesso_cozinha = usuarioAutenticado.permissoes.cozinha;
      req.session.acesso_estoque = usuarioAutenticado.permissoes.estoque;
      req.session.acesso_relatorios = usuarioAutenticado.permissoes.relatorios;
      req.session.acesso_configuracoes = usuarioAutenticado.permissoes.configuracoes;

      res.redirect('/inicio');
    } catch (error: any) {
      res.render('autenticacao/login', {
        titulo: 'Login',
        erro: error.message || 'Erro interno ao realizar autenticação.'
      });
    }
  }

  // Encerra a sessão
  logout(req: Request, res: Response): void {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }
}

export default new AutenticacaoController();