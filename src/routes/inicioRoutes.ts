import { Router } from 'express';
import inicioController from '../controllers/inicioController';
import { verificarAutenticacao } from '../middlewares/autenticacaoMiddleware';

const router = Router();

router.use(verificarAutenticacao);

router.get('/inicio', inicioController.exibirDashboard);

export default router;