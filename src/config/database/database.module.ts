import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './typeorm.provider';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}