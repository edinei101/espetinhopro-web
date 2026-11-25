import { Injectable } from '@nestjs/common';
import { AppDataSource } from '../../config/database/typeorm.provider';

@Injectable()
export class InicioService {
  async obterDadosPainel(usuario: any) {
    // 1. Total de mesas ativas (não excluídas)
    const [totalMesasRow] = await AppDataSource.query(
      `SELECT COUNT(*) AS total 
       FROM mesas 
       WHERE ativo = 1 AND status != 'EXCLUIDA'`
    );
    const totalMesas = Number(totalMesasRow?.total || 0);

    // 2. Mesas atualmente ocupadas (com comandas ABERTA ou AGUARDANDO_PAGAMENTO)
    const [mesasOcupadasRow] = await AppDataSource.query(
      `SELECT COUNT(DISTINCT m.id) AS ocupadas
       FROM mesas m
       INNER JOIN comandas c ON c.mesa_id = m.id
       WHERE m.ativo = 1 
         AND m.status != 'EXCLUIDA'
         AND c.tipo = 'MESA' 
         AND c.status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO')`
    );
    const mesasOcupadas = Number(mesasOcupadasRow?.ocupadas || 0);

    // 3. Mesas livres = Total - Ocupadas (nunca negativo)
    const mesasLivres = Math.max(0, totalMesas - mesasOcupadas);

    // 4. Clientes ativos no Balcão
    const [clientesBalcaoRow] = await AppDataSource.query(
      `SELECT COUNT(*) AS total 
       FROM comandas 
       WHERE tipo = 'BALCAO' 
         AND status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO')`
    );
    const clientesBalcao = Number(clientesBalcaoRow?.total || 0);

    return {
      nomeOperador: usuario?.nome || 'Operador',
      perfil: Number(usuario?.perfil_id) === 1 ? 'Administrador' : 'Atendente',
      totalMesas,
      mesasOcupadas,
      mesasLivres,
      clientesBalcao,
    };
  }
}