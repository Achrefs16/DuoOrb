import { Module } from '@nestjs/common';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
