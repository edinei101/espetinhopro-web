import db from '../config/database';

export interface DashboardDadosDTO {
  mesasLivres: number;
  totalMesas: number;
  mesasOcupadas: number;
  clientesBalcao: number;
}

export class InicioService {
  async obterIndicadores(): Promise<DashboardDadosDTO> {
    try {
      // 1. Totaliza apenas mesas ativas e não excluídas
      const [mesasRows]: any = await db.query(
        `SELECT 
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN status = 'OCUPADA' THEN 1 ELSE 0 END), 0) AS ocupadas,
           COALESCE(SUM(CASE WHEN status = 'LIVRE' THEN 1 ELSE 0 END), 0) AS livres
         FROM mesas 
         WHERE status != 'EXCLUIDA' AND ativo = 1`
      );

      const totalMesas = Number(mesasRows[0]?.total || 0);
      const mesasOcupadas = Number(mesasRows[0]?.ocupadas || 0);
      const mesasLivres = Number(mesasRows[0]?.livres || 0);

      // 2. Comandas ativas no Balcão
      const [balcaoRows]: any = await db.query(
        `SELECT COUNT(*) AS total_balcao 
         FROM comandas 
         WHERE tipo = 'BALCAO' AND status IN ('ABERTA', 'AGUARDANDO_PAGAMENTO')`
      );

      const clientesBalcao = Number(balcaoRows[0]?.total_balcao || 0);

      return {
        mesasLivres,
        totalMesas,
        mesasOcupadas,
        clientesBalcao
      };
    } catch (error) {
      console.error('Erro ao buscar indicadores no InicioService:', error);
      return {
        mesasLivres: 0,
        totalMesas: 0,
        mesasOcupadas: 0,
        clientesBalcao: 0
      };
    }
  }
}

export const inicioService = new InicioService();