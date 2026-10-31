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
      // 1. Total de mesas e mesas ocupadas
      const [mesasRows]: any = await db.query(
        `SELECT 
           COUNT(*) AS total, 
           COALESCE(SUM(CASE WHEN status = 'OCUPADA' THEN 1 ELSE 0 END), 0) AS ocupadas 
         FROM mesas 
         WHERE status != 'EXCLUIDA'`
      );

      const totalMesas = Number(mesasRows[0]?.total || 0);
      const mesasOcupadas = Number(mesasRows[0]?.ocupadas || 0);
      const mesasLivres = Math.max(0, totalMesas - mesasOcupadas);

      // 2. Clientes / Comandas ativas no Balcão
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
      // Fallback seguro caso haja alguma oscilação no banco
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