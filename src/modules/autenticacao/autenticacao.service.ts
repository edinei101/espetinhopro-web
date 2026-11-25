import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { AppDataSource } from '../../config/database/typeorm.provider';
import { LoginDto } from './dtos/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AutenticacaoService implements OnModuleInit {
  async onModuleInit() {
    await this.garantirUsuarioAdminPadrao();
  }

  // Provisiona o usuário ADMIN_USER e ADMIN_PASS do .env se não existir nenhum admin válido
  async garantirUsuarioAdminPadrao(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      const adminLogin = (process.env.ADMIN_USER || 'admin').trim().toLowerCase();
      const adminSenhaPlana = process.env.ADMIN_PASS || '123456';

      // 1. Garante a existência do perfil Administrador (ID 1)
      const perfis: any[] = await AppDataSource.query(
        'SELECT id FROM perfis WHERE id = 1 LIMIT 1',
      );
      if (perfis.length === 0) {
        await AppDataSource.query(
          "INSERT INTO perfis (id, nome) VALUES (1, 'Administrador')",
        );
      }

      // 2. Verifica se o usuário admin existe no banco
      const usuarios: any[] = await AppDataSource.query(
        'SELECT id, senha, primeiro_acesso FROM usuarios WHERE LOWER(email) = ? LIMIT 1',
        [adminLogin],
      );

      const hashSenha = await bcrypt.hash(adminSenhaPlana, 10);

      if (usuarios.length === 0) {
        // Cria o usuário administrador inicial com primeiro_acesso = 1
        await AppDataSource.query(
          `INSERT INTO usuarios (
            nome, email, senha, perfil_id, primeiro_acesso, ativo,
            acesso_salao, acesso_caixa, acesso_cozinha, acesso_estoque,
            acesso_relatorios, acesso_configuracoes
          ) VALUES (?, ?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1)`,
          ['Administrador', adminLogin, hashSenha],
        );
        console.log(`✅ [Seed] Usuário '${adminLogin}' criado com senha inicial '${adminSenhaPlana}' e primeiro_acesso = 1.`);
      } else {
        // Se estiver em primeiro_acesso = 1, garante que a senha inicial do .env funcione (corrige hashes inválidos)
        const u = usuarios[0];
        if (Number(u.primeiro_acesso) === 1) {
          const valida = await bcrypt.compare(adminSenhaPlana, u.senha || '').catch(() => false);
          if (!valida && u.senha !== adminSenhaPlana) {
            await AppDataSource.query(
              'UPDATE usuarios SET senha = ?, ativo = 1 WHERE id = ?',
              [hashSenha, u.id],
            );
            console.log(`✅ [Seed] Senha inicial do '${adminLogin}' sincronizada com o .env.`);
          }
        }
      }
    } catch (error: any) {
      console.warn('⚠️ [Seed] Aviso ao verificar usuário administrador inicial:', error.message);
    }
  }

  async validarCredenciais(dados: LoginDto): Promise<any> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const identificador = (dados.login || (dados as any).email || '').trim().toLowerCase();
    const senhaInformada = (dados.senha || '').trim();

    if (!identificador || !senhaInformada) {
      throw new UnauthorizedException('Preencha o usuário e a senha.');
    }

    // Se o usuário digitou o login do ADMIN_USER, garante que o seed rodou
    const adminLoginEnv = (process.env.ADMIN_USER || 'admin').trim().toLowerCase();
    if (identificador === adminLoginEnv) {
      await this.garantirUsuarioAdminPadrao();
    }

    // Busca o usuário pelo email/login ou pelo nome
    const rows: any[] = await AppDataSource.query(
      `SELECT u.*, p.nome AS perfil_nome
       FROM usuarios u
       LEFT JOIN perfis p ON p.id = u.perfil_id
       WHERE (LOWER(u.email) = ? OR LOWER(u.nome) = ?) AND u.ativo = 1
       LIMIT 1`,
      [identificador, identificador],
    );

    if (!rows || rows.length === 0) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');
    }

    const usuario = rows[0];

    let senhaValida = false;
    if (
      usuario.senha &&
      (usuario.senha.startsWith('$2a$') ||
        usuario.senha.startsWith('$2b$') ||
        usuario.senha.startsWith('$2y$'))
    ) {
      senhaValida = await bcrypt.compare(senhaInformada, usuario.senha);
    } else {
      senhaValida = usuario.senha === senhaInformada;
    }

    if (!senhaValida) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    return usuario;
  }
}