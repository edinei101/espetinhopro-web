import { Router } from 'express';
import mesaController from '../controllers/mesaController';
import { verificarAutenticacao } from '../middlewares/autenticacaoMiddleware';

const router = Router();

router.use(verificarAutenticacao);

// Painel principal e abertura
router.get('/mesas', mesaController.listarMesas);
router.post('/mesas/abrir', mesaController.abrirComandaMesa);

// Detalhes da comanda e lançamentos
router.get('/mesas/comanda/:id', mesaController.exibirComandaMesa);
router.post('/mesas/comanda/:id/adicionar', mesaController.adicionarItem);
router.post('/mesas/comanda/:id/remover/:itemId', mesaController.removerItem);

// Ações Operacionais: Produção, Cancelamento e Caixa
router.post('/mesas/comanda/:id/enviar-producao', mesaController.enviarProducao);
router.post('/mesas/comanda/:id/cancelar', mesaController.cancelarComanda);
router.post('/mesas/comanda/:id/fechar-conta', mesaController.solicitarFechamento);

export default router;