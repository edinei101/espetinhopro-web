import db from '../config/database';

export interface MesaDTO {
  numero: number;
  nomeIdentificador?: string | null;
  ativo?: number;
}

export class CadastrarMesaService {
  // 1. Listar todas as mesas (exceto as marcadas como EXCLUIDA) com contagem de comandas ativas
  async listarTodas(): Promise<any[]> {
    const [mesas]: any = await db.query(
      `SELECT m.*,
              (SELECT COUNT(*) 
               FROM comandas c 
               WHERE c.mesa_id = m.id AND c.status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO')
              ) AS comandas_ativas
       FROM mesas m
       WHERE m.status != 'EXCLUIDA'
       ORDER BY m.numero ASC`
    );

    return mesas;
  }

  // 2. Cadastrar ou reativar mesa
  async criar(dados: MesaDTO): Promise<{ reativada: boolean }> {
    if (!dados.numero || dados.numero <= 0) {
      throw new Error('Número de mesa inválido.');
    }

    const [mesaExistente]: any = await db.query(
      'SELECT id, status, ativo FROM mesas WHERE numero = ? LIMIT 1',
      [dados.numero]
    );

    if (mesaExistente.length > 0) {
      const mesa = mesaExistente[0];
      if (mesa.status === 'EXCLUIDA' || mesa.ativo === 0) {
        await db.query(
          `UPDATE mesas 
           SET nome_identificador = ?, status = 'LIVRE', ativo = 1 
           WHERE id = ?`,
          [dados.nomeIdentificador || null, mesa.id]
        );
        return { reativada: true };
      } else {
        throw new Error(`A Mesa número ${dados.numero} já está cadastrada.`);
      }
    }

    await db.query(
      `INSERT INTO mesas (numero, nome_identificador, status, ativo) 
       VALUES (?, ?, 'LIVRE', 1)`,
      [dados.numero, dados.nomeIdentificador || null]
    );

    return { reativada: false };
  }

  // 3. Atualizar dados cadastrais da mesa
  async atualizar(id: number, dados: MesaDTO): Promise<void> {
    if (!dados.numero || dados.numero <= 0) {
      throw new Error('Número de mesa inválido.');
    }

    // Impede desativar se houver comanda aberta
    if (dados.ativo === 0) {
      const [comandasAbertas]: any = await db.query(
        "SELECT id FROM comandas WHERE mesa_id = ? AND status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO') LIMIT 1",
        [id]
      );
      if (comandasAbertas.length > 0) {
        throw new Error('Não é possível desativar uma mesa em atendimento.');
      }
    }

    // Verifica duplicação de número com outra mesa
    const [duplicada]: any = await db.query(
      'SELECT id FROM mesas WHERE numero = ? AND id != ? LIMIT 1',
      [dados.numero, id]
    );
    if (duplicada.length > 0) {
      throw new Error(`Já existe outra mesa com o número ${dados.numero}.`);
    }

    await db.query(
      `UPDATE mesas 
       SET numero = ?, nome_identificador = ?, ativo = ? 
       WHERE id = ?`,
      [dados.numero, dados.nomeIdentificador || null, dados.ativo ?? 1, id]
    );
  }

  // 4. Excluir mesa (Soft delete: status = 'EXCLUIDA', ativo = 0)
  async excluir(id: number): Promise<void> {
    const [comandasAbertas]: any = await db.query(
      "SELECT id FROM comandas WHERE mesa_id = ? AND status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO') LIMIT 1",
      [id]
    );

    if (comandasAbertas.length > 0) {
      throw new Error('Não é possível excluir uma mesa em atendimento.');
    }

    await db.query(
      "UPDATE mesas SET status = 'EXCLUIDA', ativo = 0 WHERE id = ?",
      [id]
    );
  }
}

export const cadastrarMesaService = new CadastrarMesaService();