import { Router } from 'express';
import balcaoController from '../controllers/balcaoController';
import { verificarAutenticacao } from '../middlewares/autenticacaoMiddleware';

const router = Router();

router.use(verificarAutenticacao);

// Rotas de listagem e criação
router.get('/balcao', balcaoController.listarComandas);
router.post('/balcao/nova', balcaoController.abrirComanda);

// Rotas de detalhes, adição e remoção de itens
router.get('/balcao/comanda/:id', balcaoController.exibirComanda);
router.post('/balcao/comanda/:id/adicionar', balcaoController.adicionarItem);
router.post('/balcao/comanda/:id/remover/:itemId', balcaoController.removerItem);

// Ações Operacionais: Produção, Cancelamento e Caixa
router.post('/balcao/comanda/:id/enviar-producao', balcaoController.enviarProducao);
router.post('/balcao/comanda/:id/cancelar', balcaoController.cancelarComanda);
router.post('/balcao/comanda/:id/fechar-conta', balcaoController.solicitarFechamento);

export default router;