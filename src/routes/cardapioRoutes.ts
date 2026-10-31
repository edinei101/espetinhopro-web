import { Router } from 'express';
import { cardapioController } from '../controllers/cardapioController';

const router = Router();

// Middleware de proteção de sessão
const verificarAutenticacao = (req: any, res: any, next: any) => {
  if (req.session && req.session.logado) {
    return next();
  }
  return res.redirect('/login');
};

router.use(verificarAutenticacao);

// 1. Listagem do cardápio por abas/categorias
router.get('/cardapio', (req, res) => cardapioController.listar(req, res));

// 2. Cadastro de novo item
router.post('/cardapio/novo', (req, res) => cardapioController.criar(req, res));

// 3. Edição de item
router.post('/cardapio/:id/editar', (req, res) => cardapioController.atualizar(req, res));

// 4. Exclusão (Soft Delete)
router.post('/cardapio/:id/excluir', (req, res) => cardapioController.excluir(req, res));

export default router;