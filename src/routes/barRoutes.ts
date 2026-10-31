import { Router, Request, Response, NextFunction } from 'express';
import barController from '../controllers/barController';
import * as authMiddleware from '../middlewares/autenticacaoMiddleware';

const router = Router();

const middlewareAuth = 
  (authMiddleware as any).verificarAutenticacao || 
  (authMiddleware as any).default || 
  ((_req: Request, _res: Response, next: NextFunction) => next());

router.use(middlewareAuth);

// Painel KDS do Bar
router.get('/bar', (req: Request, res: Response) => barController.exibirPainel(req, res));

// Ações do Bar
router.post('/bar/pedido/:id/iniciar', (req: Request, res: Response) => barController.iniciarPreparo(req, res));
router.post('/bar/pedido/:id/concluir', (req: Request, res: Response) => barController.concluirPreparo(req, res));

export default router;