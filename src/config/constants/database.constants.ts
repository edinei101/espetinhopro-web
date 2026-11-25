import { DataSource } from 'typeorm';

import dotenv from 'dotenv';

dotenv.config();

export const databaseProviders = [
  {
    
    useFactory: async () => {
      const dataSource = new DataSource({
        type: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'espetinho_web_db',
        entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: false,
      });

      return dataSource.initialize();
    },
  },
];