import { Module } from '@nestjs/common';
import { DatabaseModule } from './config/database/database.module';
import { AutenticacaoModule } from './modules/autenticacao/autenticacao.module';
import { InicioModule } from './modules/inicio/inicio.module';
import { MesasModule } from './modules/mesas/mesas.module';
import { BalcaoModule } from './modules/balcao/balcao.module';
import { CozinhaModule } from './modules/cozinha/cozinha.module';
import { BarModule } from './modules/bar/bar.module';
import { CaixaModule } from './modules/caixa/caixa.module';
import { CardapioModule } from './modules/cardapio/cardapio.module';
import { EstoqueModule } from './modules/estoque/estoque.module';
import { UsuarioModule } from './modules/usuarios/usuario.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { ImpressaoModule } from './modules/impressao/impressao.module';

@Module({
  imports: [
    DatabaseModule,
    AutenticacaoModule,
    InicioModule,
    MesasModule,
    BalcaoModule,
    CozinhaModule,
    BarModule,
    CaixaModule,
    CardapioModule,
    EstoqueModule,
    UsuarioModule,
    RelatoriosModule,
    ImpressaoModule,
  ],
})
export class AppModule {}