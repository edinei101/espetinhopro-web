import { Controller, Get, Post, Req, Res, Param, Body, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { UsuarioService } from './usuario.service';
import {
  CriarUsuarioDto,
  AtualizarUsuarioDto,
  TrocarSenhaPrimeiroAcessoDto,
} from './dtos/usuario.dto';

@Controller('usuarios')
export class UsuarioController {
  constructor(
    @Inject(UsuarioService)
    private readonly usuarioService: UsuarioService,
  ) {
    this.index = this.index.bind(this);
    this.criar = this.criar.bind(this);
    this.atualizarComEditar = this.atualizarComEditar.bind(this);
    this.atualizarDireto = this.atualizarDireto.bind(this);
    this.resetarSenha = this.resetarSenha.bind(this);
    this.trocarSenhaPrimeiroAcesso = this.trocarSenhaPrimeiroAcesso.bind(this);
    this.excluir = this.excluir.bind(this);
    this.reativar = this.reativar.bind(this);
  }

  private getService(): UsuarioService {
    return this.usuarioService || new UsuarioService();
  }

  @Get()
  async index(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      // Apenas Administrador (perfil_id === 1) pode acessar gestão de usuários
      if (session.usuario.perfil_id !== 1) {
        return res.redirect('/inicio?erro=Acesso+n%C3%A3o+autorizado');
      }

      const mostrarTodos = req.query.mostrarTodos === 'true' || req.query.inativos === '1' || req.query.status === 'todos';
      const dados = await this.getService().listar(mostrarTodos);

      const ehSuperAdmin = session.usuario.id === 1 || session.usuario.perfil_id === 1;

      res.render('usuarios/listar', {
        titulo: 'Gestão de Usuários',
        moduloAtual: 'usuarios',
        usuario: session.usuario,
        mostrarTodos,
        mensagem: req.query.msg || req.query.mensagem || null,
        erro: req.query.erro || null,
        usuarios: dados?.usuarios || [],
        perfis: dados?.perfis || [],
        ehSuperAdmin,
        nomePerfilBaixo: '',
        semAcessoPainel: false,
      });
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).send('Erro interno ao carregar usuários.');
    }
  }

  @Post('novo')
  async criar(
    @Body() dto: CriarUsuarioDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (session?.usuario?.perfil_id !== 1) {
        return res.redirect('/inicio?erro=Acesso+n%C3%A3o+autorizado');
      }

      if (!dto.nome?.trim() || !dto.email?.trim() || !dto.perfil_id) {
        return res.redirect('/usuarios?erro=Todos+os+campos+s%C3%A3o+obrigat%C3%B3rios');
      }

      const ehSuperAdmin = session.usuario.id === 1 || session.usuario.perfil_id === 1;

      await this.getService().criar({
        nome: dto.nome.trim(),
        email: dto.email.trim().toLowerCase(),
        perfilId: Number(dto.perfil_id),
        ehSuperAdmin,
        acessoSalao: dto.acesso_salao ? 1 : 0,
        acessoCaixa: dto.acesso_caixa ? 1 : 0,
        acessoCozinha: dto.acesso_cozinha ? 1 : 0,
        acessoEstoque: dto.acesso_estoque ? 1 : 0,
        acessoRelatorios: dto.acesso_relatorios ? 1 : 0,
        acessoConfiguracoes: dto.acesso_configuracoes ? 1 : 0,
      } as any);

      res.redirect('/usuarios?msg=Usu%C3%A1rio+cadastrado+com+sucesso');
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao cadastrar usuário');
      res.redirect(`/usuarios?erro=${mensagem}`);
    }
  }

  @Post(':id/editar')
  async atualizarComEditar(
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.processarAtualizacao(id, dto, req, res);
  }

  @Post(':id')
  async atualizarDireto(
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.processarAtualizacao(id, dto, req, res);
  }

  private async processarAtualizacao(
    id: string,
    dto: AtualizarUsuarioDto,
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (session?.usuario?.perfil_id !== 1) {
        return res.redirect('/inicio?erro=Acesso+n%C3%A3o+autorizado');
      }

      const body = req.body || {};
      const ehSuperAdmin = session.usuario.id === 1 || session.usuario.perfil_id === 1;

      // Checkboxes HTML: quando marcados chegam como '1', 'on' ou true. Quando desmarcados chegam como undefined.
      const parseCheckbox = (val: any): number => {
        return val === 'on' || val === '1' || val === 1 || val === true ? 1 : 0;
      };

      // Normaliza o campo ativo: se veio marcado é 1, se foi desmarcado vira 0
      const ativoVal = parseCheckbox(body.ativo);

      await this.getService().atualizar({
        id: Number(id),
        nome: (body.nome || dto.nome || '').trim(),
        email: (body.email || dto.email || '').trim().toLowerCase(),
        perfilId: Number(body.perfil_id || dto.perfil_id),
        ehSuperAdmin,
        novaSenha: body.nova_senha || dto.nova_senha || null,
        ativo: ativoVal,
        acessoSalao: parseCheckbox(body.acesso_salao ?? dto.acesso_salao),
        acessoCaixa: parseCheckbox(body.acesso_caixa ?? dto.acesso_caixa),
        acessoCozinha: parseCheckbox(body.acesso_cozinha ?? dto.acesso_cozinha),
        acessoEstoque: parseCheckbox(body.acesso_estoque ?? dto.acesso_estoque),
        acessoRelatorios: parseCheckbox(body.acesso_relatorios ?? dto.acesso_relatorios),
        acessoConfiguracoes: parseCheckbox(body.acesso_configuracoes ?? dto.acesso_configuracoes),
      });

      res.redirect('/usuarios?msg=Usu%C3%A1rio+atualizado+com+sucesso');
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao atualizar usuário');
      res.redirect(`/usuarios?erro=${mensagem}`);
    }
  }

  @Post(':id/resetar-senha')
  async resetarSenha(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (session?.usuario?.perfil_id !== 1) {
        return res.redirect('/inicio?erro=Acesso+n%C3%A3o+autorizado');
      }

      await this.getService().resetarSenha(Number(id));
      res.redirect('/usuarios?msg=Senha+resetada+para+o+padr%C3%A3o+com+sucesso');
    } catch (error: any) {
      console.error('Erro ao resetar senha do usuário:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao resetar senha');
      res.redirect(`/usuarios?erro=${mensagem}`);
    }
  }

  @Post('trocar-senha-primeiro-acesso')
  async trocarSenhaPrimeiroAcesso(
    @Body() dto: TrocarSenhaPrimeiroAcessoDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      if (!dto.senha_atual || !dto.nova_senha || !dto.confirmacao_senha) {
        return res.redirect('/login?erro=Preencha+todos+os+campos+de+senha');
      }

      if (dto.nova_senha !== dto.confirmacao_senha) {
        return res.redirect('/login?erro=A+nova+senha+e+a+confirma%C3%A7%C3%A3o+n%C3%A3o+conferem');
      }

      await this.getService().trocarSenhaPrimeiroAcesso({
        usuarioId: session.usuario.id,
        senhaAtual: dto.senha_atual,
        novaSenha: dto.nova_senha,
      } as any);

      session.usuario.primeiro_acesso = 0;
      res.redirect('/inicio?msg=Senha+alterada+com+sucesso');
    } catch (error: any) {
      console.error('Erro ao trocar senha de primeiro acesso:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao alterar senha');
      res.redirect(`/login?erro=${mensagem}`);
    }
  }

  @Post(':id/excluir')
  async excluir(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (session?.usuario?.perfil_id !== 1) {
        return res.redirect('/inicio?erro=Acesso+n%C3%A3o+autorizado');
      }

      const idNum = Number(id);
      if (idNum === session.usuario.id) {
        return res.redirect('/usuarios?erro=N%C3%A3o+%C3%A9+permitido+desativar+o+pr%C3%B3prio+usu%C3%A1rio+em+uso');
      }

      await this.getService().excluir(idNum);
      res.redirect('/usuarios?msg=Usu%C3%A1rio+desativado+com+sucesso');
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao desativar usuário');
      res.redirect(`/usuarios?erro=${mensagem}`);
    }
  }

  @Post(':id/reativar')
  async reativar(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = (req as any).session;
      if (session?.usuario?.perfil_id !== 1) {
        return res.redirect('/inicio?erro=Acesso+n%C3%A3o+autorizado');
      }

      await this.getService().reativar(Number(id));
      res.redirect('/usuarios?msg=Usu%C3%A1rio+reativado+com+sucesso');
    } catch (error: any) {
      console.error('Erro ao reativar usuário:', error);
      const mensagem = encodeURIComponent(error.message || 'Erro ao reativar usuário');
      res.redirect(`/usuarios?erro=${mensagem}`);
    }
  }
}