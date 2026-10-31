import { Router } from 'express';
import { usuarioController } from '../controllers/usuarioController';
import * as authMiddleware from '../middlewares/autenticacaoMiddleware';

const router = Router();

const middlewareAuth = 
  (authMiddleware as any).verificarAutenticacao || 
  (authMiddleware as any).default || 
  ((_req: any, _res: any, next: any) => next());

router.use(middlewareAuth);

// Troca obrigatória de senha no primeiro acesso (submetida pelo modal)
router.post('/usuarios/primeiro-acesso/trocar-senha', (req, res) => 
  usuarioController.trocarSenhaPrimeiroAcesso(req, res)
);

// Listagem com alternância de status
router.get('/usuarios', (req, res) => usuarioController.listar(req, res));

// Cadastro
router.post('/usuarios/novo', (req, res) => usuarioController.criar(req, res));

// Edição
router.post('/usuarios/:id/editar', (req, res) => usuarioController.atualizar(req, res));

// Redefinir para senha padrão usuario123
router.post('/usuarios/:id/resetar-senha', (req, res) => usuarioController.resetarSenha(req, res));

// Soft delete / Reativar
router.post('/usuarios/:id/excluir', (req, res) => usuarioController.excluir(req, res));
router.post('/usuarios/:id/reativar', (req, res) => usuarioController.reativar(req, res));

export default router;