import { Controller, Get, Post, Param, Req, Res, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { BarService } from './bar.service';

@Controller('bar')
export class BarController {
  constructor(
    @Inject(BarService)
    private readonly barService: BarService,
  ) {
    this.exibirPainel = this.exibirPainel.bind(this);
    this.iniciarPreparoPrincipal = this.iniciarPreparoPrincipal.bind(this);
    this.iniciarPreparoAlternativo = this.iniciarPreparoAlternativo.bind(this);
    this.concluirPreparoPrincipal = this.concluirPreparoPrincipal.bind(this);
    this.concluirPreparoAlternativo = this.concluirPreparoAlternativo.bind(this);
  }

  private getService(): BarService {
    return this.barService || new BarService();
  }

  @Get()
  async exibirPainel(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const pedidos = await this.getService().listarFilaBar();

      res.render('bar/painel', {
        titulo: 'Bar / Bebidas (KDS)',
        moduloAtual: 'bar',
        usuario: session.usuario,
        pedidos,
      });
    } catch (error) {
      console.error('Erro ao carregar painel do bar:', error);
      res.status(500).send('Erro interno ao carregar o bar.');
    }
  }

  // Rota disparada pela view EJS: /bar/pedido/:id/iniciar
  @Post('pedido/:id/iniciar')
  async iniciarPreparoPrincipal(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.processarInicioPreparo(id, res);
  }

  // Rota alternativa: /bar/:id/iniciar
  @Post(':id/iniciar')
  async iniciarPreparoAlternativo(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.processarInicioPreparo(id, res);
  }

  private async processarInicioPreparo(id: string, res: Response): Promise<void> {
    try {
      const pedidoId = Number(id);
      await this.getService().iniciarPreparo(pedidoId);
      res.redirect('/bar');
    } catch (error) {
      console.error('Erro ao iniciar atendimento no bar:', error);
      res.status(500).send('Erro ao atualizar status do pedido no bar.');
    }
  }

  // Rota disparada pela view EJS: /bar/pedido/:id/concluir
  @Post('pedido/:id/concluir')
  async concluirPreparoPrincipal(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.processarConclusaoPreparo(id, res);
  }

  // Rota alternativa: /bar/:id/concluir
  @Post(':id/concluir')
  async concluirPreparoAlternativo(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.processarConclusaoPreparo(id, res);
  }

  private async processarConclusaoPreparo(id: string, res: Response): Promise<void> {
    try {
      const pedidoId = Number(id);
      await this.getService().concluirPreparo(pedidoId);
      res.redirect('/bar');
    } catch (error) {
      console.error('Erro ao concluir bebidas no bar:', error);
      res.status(500).send('Erro ao concluir pedido no bar.');
    }
  }
}