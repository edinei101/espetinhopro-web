import { Controller, Get, Post, Param, Req, Res, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { CozinhaService } from './cozinha.service';

@Controller('cozinha')
export class CozinhaController {
  constructor(
    @Inject(CozinhaService)
    private readonly cozinhaService: CozinhaService,
  ) {
    this.exibirPainel = this.exibirPainel.bind(this);
    this.iniciarPreparoPrincipal = this.iniciarPreparoPrincipal.bind(this);
    this.iniciarPreparoAlternativo = this.iniciarPreparoAlternativo.bind(this);
    this.concluirPreparoPrincipal = this.concluirPreparoPrincipal.bind(this);
    this.concluirPreparoAlternativo = this.concluirPreparoAlternativo.bind(this);
  }

  private getService(): CozinhaService {
    return this.cozinhaService || new CozinhaService();
  }

  @Get()
  async exibirPainel(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const session = (req as any).session;
      if (!session?.usuario) return res.redirect('/login');

      const pedidos = await this.getService().listarFilaCozinha();

      res.render('cozinha/painel', {
        titulo: 'Cozinha / Grelha (KDS)',
        moduloAtual: 'cozinha',
        usuario: session.usuario,
        pedidos,
      });
    } catch (error) {
      console.error('Erro ao carregar painel da cozinha:', error);
      res.status(500).send('Erro interno ao carregar a cozinha.');
    }
  }

  // Rota disparada pela view: /cozinha/pedido/:id/iniciar
  @Post('pedido/:id/iniciar')
  async iniciarPreparoPrincipal(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.processarInicioPreparo(id, res);
  }

  // Rota alternativa: /cozinha/:id/iniciar
  @Post(':id/iniciar')
  async iniciarPreparoAlternativo(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.processarInicioPreparo(id, res);
  }

  private async processarInicioPreparo(id: string, res: Response): Promise<void> {
    try {
      const pedidoId = Number(id);
      await this.getService().iniciarPreparo(pedidoId);
      res.redirect('/cozinha');
    } catch (error) {
      console.error('Erro ao iniciar preparo:', error);
      res.status(500).send('Erro ao atualizar status do pedido.');
    }
  }

  // Rota disparada pela view: /cozinha/pedido/:id/concluir
  @Post('pedido/:id/concluir')
  async concluirPreparoPrincipal(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.processarConclusaoPreparo(id, res);
  }

  // Rota alternativa: /cozinha/:id/concluir
  @Post(':id/concluir')
  async concluirPreparoAlternativo(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.processarConclusaoPreparo(id, res);
  }

  private async processarConclusaoPreparo(id: string, res: Response): Promise<void> {
    try {
      const pedidoId = Number(id);
      await this.getService().concluirPreparo(pedidoId);
      res.redirect('/cozinha');
    } catch (error) {
      console.error('Erro ao concluir preparo:', error);
      res.status(500).send('Erro ao concluir pedido.');
    }
  }
}