import { Router } from 'express';
import { estoqueController } from '../controllers/estoqueController';

const router = Router();

// Middleware de autenticação simples
const verificarAutenticacao = (req: any, res: any, next: any) => {
  if (req.session && req.session.logado) {
    return next();
  }
  return res.redirect('/login');
};

router.use(verificarAutenticacao);

// Listar produtos e alertas de estoque baixo
router.get('/estoque', (req, res) => estoqueController.listar(req, res));

// Criar novo produto no estoque
router.post('/estoque/novo', (req, res) => estoqueController.criar(req, res));

// Editar produto existente
router.post('/estoque/:id/editar', (req, res) => estoqueController.atualizar(req, res));

// Movimentação manual de saldo (Entrada, Saída, Perda, Ajuste)
router.post('/estoque/:id/movimentar', (req, res) => estoqueController.movimentar(req, res));

// Excluir com trava de estoque > 0
router.post('/estoque/:id/excluir', (req, res) => estoqueController.excluir(req, res));

export default router;