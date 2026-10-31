import { Router } from 'express';
import caixaController from '../controllers/caixaController';
import * as authMiddleware from '../middlewares/autenticacaoMiddleware';

const router = Router();

const middlewareAuth = 
  (authMiddleware as any).verificarAutenticacao || 
  (authMiddleware as any).default || 
  ((_req: any, _res: any, next: any) => next());

router.use(middlewareAuth);

// Painel principal do caixa
router.get('/caixa', (req, res) => caixaController.exibirPainel(req, res));

// Abertura de caixa
router.post('/caixa/abrir', (req, res) => caixaController.abrirCaixa(req, res));

// Fechamento de caixa com Rateio de Taxas
router.post('/caixa/:id/fechar', (req, res) => caixaController.fecharCaixa(req, res));

// Pagamento de comanda
router.post('/caixa/comanda/:id/pagar', (req, res) => caixaController.processarPagamento(req, res));

// Adicionar doce diretamente na comanda da mesa
router.post('/caixa/comanda/:id/adicionar-item', (req, res) => caixaController.adicionarItemCheckoutNaComanda(req, res));

// Venda avulsa de doces no balcão
router.post('/caixa/venda-rapida', (req, res) => caixaController.vendaRapida(req, res));

export default router;