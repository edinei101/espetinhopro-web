import { Router } from 'express';
import autenticacaoController from '../controllers/autenticacaoController';

const router = Router();

router.get('/login', autenticacaoController.exibirLogin);
router.post('/login', autenticacaoController.processarLogin);
router.get('/logout', autenticacaoController.logout);

export default router;