import { Request, Response } from 'express';
import { inicioService } from '../services/inicioService';

class InicioController {
  async exibirDashboard(req: Request, res: Response): Promise<void> {
    try {
      const indicadores = await inicioService.obterIndicadores();
      const nomeOperador =
        (req as any).session?.nomeUsuario ||
        (req as any).session?.usuario?.nome ||
        'Operador';

      res.render('inicio/painel', {
        titulo: 'Painel Inicial',
        moduloAtual: 'inicio',
        dados: {
          nomeOperador,
          ...indicadores
        }
      });
    } catch (error) {
      console.error('Erro no inicioController:', error);
      res.render('inicio/painel', {
        titulo: 'Painel Inicial',
        moduloAtual: 'inicio',
        dados: {
          nomeOperador: (req as any).session?.nomeUsuario || 'Operador',
          mesasLivres: 0,
          totalMesas: 0,
          mesasOcupadas: 0,
          clientesBalcao: 0
        }
      });
    }
  }
}

export const inicioController = new InicioController();
export default inicioController;