import { Router } from 'express';
import db from '../config/database';

const router = Router();

const verificarAutenticacao = (req: any, res: any, next: any) => {
  if (req.session && req.session.logado) {
    return next();
  }
  return res.redirect('/login');
};

router.use(verificarAutenticacao);

// 1. Listar mesas ativas na tela de cadastro
router.get(['/cadastrar-mesas', '/cadastrar-mesa'], async (req, res) => {
  try {
    const msg = req.query.msg ? String(req.query.msg) : null;
    const erro = req.query.erro ? String(req.query.erro) : null;

    const [mesas]: any = await db.query(
      `SELECT * FROM mesas 
       WHERE ativo = 1 
       ORDER BY numero ASC`
    );

    res.render('mesas/cadastrarMesa', {
      titulo: 'Cadastro & Gestão de Mesas',
      moduloAtual: 'cadastrar-mesas',
      mesas,
      msg,
      erro
    });
  } catch (error) {
    console.error('Erro ao listar mesas:', error);
    res.status(500).send('Erro ao carregar tela de cadastro de mesas.');
  }
});

// 2. Cadastrar ou Reativar mesa
router.post('/cadastrar-mesas/nova', async (req, res) => {
  try {
    const numero = parseInt(req.body.numero, 10);
    const nomeIdentificador = req.body.nome_identificador ? req.body.nome_identificador.trim() : null;

    if (!numero || isNaN(numero)) {
      return res.redirect('/cadastrar-mesas?erro=Informe um número de mesa válido.');
    }

    // Verifica se já existe esse número de mesa no banco
    const [existente]: any = await db.query(
      'SELECT id, ativo, status FROM mesas WHERE numero = ? LIMIT 1',
      [numero]
    );

    if (existente.length > 0) {
      const mesa = existente[0];

      if (mesa.ativo === 1) {
        return res.redirect(`/cadastrar-mesas?erro=A Mesa ${numero} já está ativa no salão.`);
      }

      // Se existia mas estava desativada (ativo = 0), reativa e atualiza os dados
      await db.query(
        'UPDATE mesas SET ativo = 1, status = "LIVRE", nome_identificador = ? WHERE id = ?',
        [nomeIdentificador, mesa.id]
      );

      return res.redirect(`/cadastrar-mesas?msg=Mesa ${numero} reativada com sucesso!`);
    }

    // Se nunca existiu, insere novo registro
    await db.query(
      'INSERT INTO mesas (numero, nome_identificador, status, ativo) VALUES (?, ?, "LIVRE", 1)',
      [numero, nomeIdentificador]
    );

    res.redirect('/cadastrar-mesas?msg=Mesa cadastrada com sucesso!');
  } catch (error) {
    console.error('Erro ao criar mesa:', error);
    res.status(500).send('Erro ao cadastrar mesa.');
  }
});

// 3. Excluir mesa (Soft delete seguro: seta ativo = 0 apenas se estiver LIVRE)
router.post('/cadastrar-mesas/:id/excluir', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [mesaRows]: any = await db.query(
      'SELECT numero, status FROM mesas WHERE id = ? LIMIT 1',
      [id]
    );

    if (mesaRows.length === 0) {
      return res.redirect('/cadastrar-mesas?erro=Mesa não encontrada.');
    }

    const mesa = mesaRows[0];

    if (mesa.status !== 'LIVRE') {
      return res.redirect(`/cadastrar-mesas?erro=A Mesa ${mesa.numero} não pode ser excluída pois está em atendimento.`);
    }

    // Desativa a mesa
    await db.query('UPDATE mesas SET ativo = 0 WHERE id = ?', [id]);

    res.redirect(`/cadastrar-mesas?msg=Mesa ${mesa.numero} excluída com sucesso!`);
  } catch (error) {
    console.error('Erro ao excluir mesa:', error);
    res.status(500).send('Erro ao excluir mesa.');
  }
});

export default router;