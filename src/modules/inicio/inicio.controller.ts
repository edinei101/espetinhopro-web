import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { InicioService } from './inicio.service';

@Controller()
export class InicioController {
  constructor(
    @Inject(InicioService)
    private readonly inicioService: InicioService,
  ) {
    this.telaInicio = this.telaInicio.bind(this);
  }

  @Get(['', 'inicio'])
  async telaInicio(@Req() req: Request, @Res() res: Response) {
    const session = req.session as any;
    if (!session?.usuario) {
      return res.redirect('/login');
    }

    const service = this.inicioService || new InicioService();
    const dados = await service.obterDadosPainel(session.usuario);

    return res.render('inicio/painel', {
      titulo: 'Painel Principal',
      moduloAtual: 'inicio',
      usuario: session.usuario,
      dados,
    });
  }
}