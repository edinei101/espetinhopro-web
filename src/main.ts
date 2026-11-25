import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import session from 'express-session';
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Permite ler formulários normais do HTML (POST do EJS)
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Pasta estática (CSS, JS, imagens)
  app.useStaticAssets(join(process.cwd(), 'public'));

  // Pasta de views EJS
  app.setBaseViewsDir(join(process.cwd(), 'src', 'views'));
  app.setViewEngine('ejs');

  // Configuração de Sessão endurecida
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'espetinhopro_segredo_super_seguro',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 8, // 8 horas
        httpOnly: true,             // Impede leitura do cookie via JS (Anti-XSS)
        sameSite: 'lax',            // Proteção contra CSRF externo
      },
    }),
  );

  // Middleware Global de Segurança (Autenticação + Primeiro Acesso + Permissões RBAC)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path;

    // 1. Libera arquivos estáticos e rotas públicas de autenticação
    if (
      path.startsWith('/css') ||
      path.startsWith('/js') ||
      path.startsWith('/img') ||
      path.startsWith('/favicon') ||
      path === '/login' ||
      path === '/logout'
    ) {
      return next();
    }

    const session = (req as any).session;
    const usuario = session?.usuario;

    // 2. Exige usuário logado para qualquer outra rota (GET ou POST)
    if (!usuario) {
      return res.redirect('/login');
    }

    // 3. Trava estrita de Primeiro Acesso
    const rotasPrimeiroAcesso = [
      '/trocar-senha-primeiro-acesso',
      '/usuarios/trocar-senha-primeiro-acesso',
    ];
    if (Number(usuario.primeiro_acesso) === 1) {
      if (!rotasPrimeiroAcesso.includes(path)) {
        return res.redirect('/trocar-senha-primeiro-acesso');
      }
      return next();
    }

    // 4. Administrador (perfil_id === 1) tem acesso livre a todos os módulos
    if (Number(usuario.perfil_id) === 1) {
      return next();
    }

    // 5. Controle de Acesso Baseado nas Permissões do Usuário (RBAC)
    if (
      (path.startsWith('/mesas') || path.startsWith('/balcao') || path.startsWith('/comanda')) &&
      !usuario.acesso_salao
    ) {
      return res.redirect('/inicio?erro=' + encodeURIComponent('Sem permissão para acessar Salão/Balcão.'));
    }

    if (path.startsWith('/caixa') && !usuario.acesso_caixa) {
      return res.redirect('/inicio?erro=' + encodeURIComponent('Sem permissão para acessar o Caixa.'));
    }

    if ((path.startsWith('/cozinha') || path.startsWith('/bar')) && !usuario.acesso_cozinha) {
      return res.redirect('/inicio?erro=' + encodeURIComponent('Sem permissão para acessar Cozinha/Bar.'));
    }

    if (path.startsWith('/estoque') && !usuario.acesso_estoque) {
      return res.redirect('/inicio?erro=' + encodeURIComponent('Sem permissão para acessar o Estoque.'));
    }

    if (path.startsWith('/relatorios') && !usuario.acesso_relatorios) {
      return res.redirect('/inicio?erro=' + encodeURIComponent('Sem permissão para acessar Relatórios.'));
    }

    if (
      (path.startsWith('/cardapio') || path.startsWith('/cadastrar-mesas') || path.startsWith('/usuarios')) &&
      !usuario.acesso_configuracoes
    ) {
      return res.redirect('/inicio?erro=' + encodeURIComponent('Sem permissão para acessar Configurações.'));
    }

    next();
  });

  const porta = process.env.PORT || 3001;
  await app.listen(porta);
  console.log(`🚀 Servidor NestJS rodando em: http://localhost:${porta}`);
}

bootstrap();