import { Router } from 'express';
import { relatorioController } from '../controllers/relatorioController';

const router = Router();

// Middleware de autenticação e controle de acesso
const verificarAcessoRelatorio = (req: any, res: any, next: any) => {
  if (!req.session || !req.session.logado) {
    return res.redirect('/login');
  }

  const user = req.session.usuario;
  // Permite Administrador (perfil 1 ou flag isAdmin) ou quem tem acesso_relatorios
  const temPermissao =
    user?.isAdmin ||
    user?.perfil_id === 1 ||
    user?.acesso_relatorios === 1 ||
    user?.acesso_relatorios === true;

  if (temPermissao) {
    return next();
  }

  return res.status(403).send('Acesso não autorizado ao módulo de relatórios.');
};

router.use(verificarAcessoRelatorio);

// Rota principal do painel de relatórios
router.get('/relatorios', (req, res) => relatorioController.index(req, res));

export default router;