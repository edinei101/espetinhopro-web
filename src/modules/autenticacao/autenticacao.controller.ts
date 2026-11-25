import { Controller, Get, Post, Req, Res, Body, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { AutenticacaoService } from './autenticacao.service';
import { LoginDto } from './dtos/login.dto';
import { AppDataSource } from '../../config/database/typeorm.provider';
import * as bcrypt from 'bcryptjs';

@Controller()
export class AutenticacaoController {
  constructor(
    @Inject(AutenticacaoService)
    private readonly authService: AutenticacaoService,
  ) {}

  private obterService(): AutenticacaoService {
    return this.authService || new AutenticacaoService();
  }

  @Get('login')
  telaLogin(@Req() req: Request, @Res() res: Response) {
    const session = (req as any).session;
    if (session?.usuario) {
      if (Number(session.usuario.primeiro_acesso) === 1) {
        return res.redirect('/trocar-senha-primeiro-acesso');
      }
      return res.redirect('/inicio');
    }

    return res.render('autenticacao/login', {
      titulo: 'Login',
      erro: req.query.erro || null,
      mensagem: req.query.msg || req.query.mensagem || null,
    });
  }

  @Post('login')
  async processarLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const service = this.obterService();
      const usuario = await service.validarCredenciais(dto);

      const session = (req as any).session;
      session.usuario = usuario;
      session.logado = true;

      return session.save(() => {
        if (Number(usuario.primeiro_acesso) === 1) {
          return res.redirect('/trocar-senha-primeiro-acesso');
        }
        return res.redirect('/inicio');
      });
    } catch (error: any) {
      console.error('❌ Erro no login:', error.message);
      const msg = encodeURIComponent(error.message || 'Falha ao autenticar.');
      return res.redirect(`/login?erro=${msg}`);
    }
  }

  @Get('trocar-senha-primeiro-acesso')
  telaPrimeiroAcesso(@Req() req: Request, @Res() res: Response) {
    const session = (req as any).session;
    if (!session?.usuario) {
      return res.redirect('/login');
    }

    return res.render('autenticacao/primeiro_acesso', {
      titulo: 'Redefinição de Senha Obrigatória',
      usuario: session.usuario,
      erro: req.query.erro || null,
    });
  }

  @Post('usuarios/trocar-senha-primeiro-acesso')
  async processarTrocaSenhaPrimeiroAcesso(
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const session = (req as any).session;
    if (!session?.usuario) {
      return res.redirect('/login');
    }

    const { senha_atual, nova_senha, confirmacao_senha } = body;

    if (!nova_senha || nova_senha.length < 4) {
      return res.redirect(
        '/trocar-senha-primeiro-acesso?erro=' +
          encodeURIComponent('A nova senha deve ter no mínimo 4 caracteres.'),
      );
    }

    if (nova_senha !== confirmacao_senha) {
      return res.redirect(
        '/trocar-senha-primeiro-acesso?erro=' +
          encodeURIComponent('A confirmação não coincide com a nova senha.'),
      );
    }

    const rows: any[] = await AppDataSource.query(
      'SELECT id, senha FROM usuarios WHERE id = ? LIMIT 1',
      [session.usuario.id],
    );

    if (rows.length === 0) {
      return res.redirect('/login');
    }

    const usuarioDb = rows[0];
    let senhaAtualValida = false;

    if (
      usuarioDb.senha &&
      (usuarioDb.senha.startsWith('$2a$') ||
        usuarioDb.senha.startsWith('$2b$') ||
        usuarioDb.senha.startsWith('$2y$'))
    ) {
      senhaAtualValida = await bcrypt.compare(senha_atual, usuarioDb.senha);
    } else {
      senhaAtualValida = usuarioDb.senha === senha_atual;
    }

    if (!senhaAtualValida) {
      return res.redirect(
        '/trocar-senha-primeiro-acesso?erro=' +
          encodeURIComponent('Senha provisória incorreta.'),
      );
    }

    const novoHash = await bcrypt.hash(nova_senha, 10);
    await AppDataSource.query(
      'UPDATE usuarios SET senha = ?, primeiro_acesso = 0 WHERE id = ?',
      [novoHash, session.usuario.id],
    );

    session.usuario.primeiro_acesso = 0;

    return session.save(() => {
      return res.redirect('/inicio');
    });
  }

  @Get('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    const session = (req as any).session;
    if (session) {
      session.destroy(() => {
        res.redirect('/login?msg=' + encodeURIComponent('Sessão encerrada com sucesso.'));
      });
    } else {
      res.redirect('/login');
    }
  }
}