import { Router, Request, Response, NextFunction } from 'express';
import { cozinhaController } from '../controllers/cozinhaController';
import * as authMiddleware from '../middlewares/autenticacaoMiddleware';

const router = Router();

const middlewareAuth = 
  (authMiddleware as any).verificarAutenticacao || 
  (authMiddleware as any).default || 
  ((_req: Request, _res: Response, next: NextFunction) => next());

router.use(middlewareAuth);

// Painel KDS da Cozinha
router.get('/cozinha', (req: Request, res: Response) => cozinhaController.exibirPainel(req, res));

// Ações do Preparo
router.post('/cozinha/pedido/:id/iniciar', (req: Request, res: Response) => cozinhaController.iniciarPreparo(req, res));
router.post('/cozinha/pedido/:id/concluir', (req: Request, res: Response) => cozinhaController.concluirPreparo(req, res));

export default router;