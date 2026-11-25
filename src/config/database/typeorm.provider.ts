import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Mesa } from '../../modules/mesas/mesa.entity';
import { Perfil } from '../../modules/usuarios/perfil.entity';
import { Usuario } from '../../modules/usuarios/usuario.entity';
import { Categoria } from '../../modules/cardapio/categoria.entity';
import { Produto } from '../../modules/cardapio/produto.entity';
import { Comanda } from '../../modules/mesas/comanda.entity';
import { Pedido } from '../../modules/cozinha/pedido.entity';
import { PedidoItem } from '../../modules/cozinha/pedido-item.entity';
import { EstoqueMovimentacao } from '../../modules/estoque/estoque-movimentacao.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'espetinhopro',
  synchronize: false,
  logging: false,
  entities: [
    Mesa,
    Perfil,
    Usuario,
    Categoria,
    Produto,
    Comanda,
    Pedido,
    PedidoItem,
    EstoqueMovimentacao,
  ],
});

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('📦 Conexão TypeORM estabelecida com sucesso com o MySQL.');
    }
  }

  async onModuleDestroy() {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }

  get dataSource(): DataSource {
    return AppDataSource;
  }
}