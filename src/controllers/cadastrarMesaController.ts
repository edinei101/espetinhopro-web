import { Request, Response } from 'express';
import { cadastrarMesaService } from '../services/cadastrarMesaService';

class CadastrarMesaController {
  // 1. Listar todas as mesas para o painel de cadastro
  async listarTodas(req: Request, res: Response): Promise<void> {
    try {
      const mesas = await cadastrarMesaService.listarTodas();
      const mensagem = req.query.msg ? String(req.query.msg) : null;
      const erro = req.query.erro ? String(req.query.erro) : null;

      res.render('mesas/cadastrarMesa', {
        titulo: 'Cadastro e Gestão de Mesas',
        moduloAtual: 'configuracoes',
        mesas,
        mensagem,
        erro
      });
    } catch (error) {
      console.error('Erro ao listar mesas:', error);
      res.status(500).send('Erro interno ao listar mesas.');
    }
  }

  // 2. Cadastrar nova mesa
  async criarMesa(req: Request, res: Response): Promise<void> {
    try {
      const numero = Number(req.body.numero);
      const nomeIdentificador = req.body.nome_identificador && req.body.nome_identificador.trim() !== ''
        ? req.body.nome_identificador.trim()
        : null;

      const resultado = await cadastrarMesaService.criar({ numero, nomeIdentificador });

      const msg = resultado.reativada
        ? 'Mesa reativada com sucesso!'
        : 'Mesa cadastrada com sucesso!';

      res.redirect(`/configuracoes/mesas?msg=${encodeURIComponent(msg)}`);
    } catch (error: any) {
      console.error('Erro ao cadastrar mesa:', error);
      const msgErro = error.code === 'ER_DUP_ENTRY'
        ? 'Este número de mesa já existe.'
        : (error.message || 'Erro ao criar mesa.');
      res.redirect(`/configuracoes/mesas?erro=${encodeURIComponent(msgErro)}`);
    }
  }

  // 3. Atualizar dados da mesa existente
  async atualizarMesa(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const numero = Number(req.body.numero);
      const nomeIdentificador = req.body.nome_identificador && req.body.nome_identificador.trim() !== ''
        ? req.body.nome_identificador.trim()
        : null;
      const ativo = req.body.ativo === 'on' || req.body.ativo === '1' ? 1 : 0;

      await cadastrarMesaService.atualizar(id, { numero, nomeIdentificador, ativo });

      res.redirect('/configuracoes/mesas?msg=Mesa atualizada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar mesa:', error);
      res.redirect(`/configuracoes/mesas?erro=${encodeURIComponent(error.message || 'Erro ao atualizar mesa.')}`);
    }
  }

  // 4. Excluir mesa
  async excluirMesa(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      await cadastrarMesaService.excluir(id);

      res.redirect('/configuracoes/mesas?msg=Mesa removida com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir mesa:', error);
      res.redirect(`/configuracoes/mesas?erro=${encodeURIComponent(error.message || 'Erro ao excluir mesa.')}`);
    }
  }
}

export const cadastrarMesaController = new CadastrarMesaController();
export default cadastrarMesaController;