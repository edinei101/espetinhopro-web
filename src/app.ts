import express, { Application, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import dotenv from 'dotenv';

// 1. Importação de todas as rotas
import autenticacaoRoutes from './routes/autenticacaoRoutes';
import inicioRoutes from './routes/inicioRoutes';
import mesaRoutes from './routes/mesaRoutes';
import balcaoRoutes from './routes/balcaoRoutes';
import cozinhaRoutes from './routes/cozinhaRoutes';
import barRoutes from './routes/barRoutes';
import caixaRoutes from './routes/caixaRoutes';
import cadastrarMesaRoutes from './routes/cadastrarMesaRoutes';
import cardapioRoutes from './routes/cardapioRoutes';
import relatorioRoutes from './routes/relatorioRoutes';
import usuarioRoutes from './routes/usuarioRoutes';
import estoqueRoutes from './routes/estoqueRoutes';

dotenv.config();

const app: Application = express();
const PORT: number = Number(process.env.PORT) || 3001;

// 2. Parsing de formulários e JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 3. Gerenciamento de Sessão
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'chave_secreta_ts_espetinhopro_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 8 // 8 horas
    }
  })
);

// 4. Configuração de Views (EJS) e Arquivos Estáticos
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '../public')));

// 5. Middleware Global: dados do usuário logado (repassa objeto completo com primeiro_acesso)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.logado) {
    res.locals.usuario = {
      logado: true,
      isAdmin: req.session.isAdmin || false,
      id: req.session.idUsuario || (req.session.usuario ? req.session.usuario.id : null),
      nome: req.session.nomeUsuario || (req.session.usuario ? req.session.usuario.nome : 'Colaborador'),
      email: req.session.usuario ? req.session.usuario.email : '',
      primeiro_acesso: req.session.primeiro_acesso ?? (req.session.usuario ? req.session.usuario.primeiro_acesso : 0),
      acesso_salao: Boolean(req.session.acesso_salao),
      acesso_caixa: Boolean(req.session.acesso_caixa),
      acesso_cozinha: Boolean(req.session.acesso_cozinha),
      acesso_estoque: Boolean(req.session.acesso_estoque),
      acesso_relatorios: Boolean(req.session.acesso_relatorios),
      acesso_configuracoes: Boolean(req.session.acesso_configuracoes)
    };
    res.locals.primeiro_acesso = res.locals.usuario.primeiro_acesso;
  } else {
    res.locals.usuario = null;
    res.locals.primeiro_acesso = 0;
  }

  res.locals.moduloAtual = res.locals.moduloAtual || '';
  next();
});
// 6. Registro das Rotas do Sistema
app.use('/', autenticacaoRoutes);
app.use('/', inicioRoutes);
app.use('/', mesaRoutes);
app.use('/', balcaoRoutes);
app.use('/', cozinhaRoutes);
app.use('/', barRoutes);
app.use('/', caixaRoutes);
app.use('/', cadastrarMesaRoutes);
app.use('/', cardapioRoutes);  // <-- Registrado na raiz '/'
app.use('/', usuarioRoutes);
app.use('/', relatorioRoutes);
app.use('/', estoqueRoutes);

// Rota raiz
app.get('/', (req: Request, res: Response) => {
  if (req.session && req.session.logado) {
    res.redirect('/inicio');
  } else {
    res.redirect('/login');
  }
});

// 7. Inicialização do Servidor HTTP
app.listen(PORT, () => {
  console.log(`👉 Início: http://localhost:${PORT}/inicio`);
});

export default app;