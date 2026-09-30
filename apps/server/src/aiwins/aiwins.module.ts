import { Module } from '@nestjs/common';
import { AiwinsController } from './aiwins.controller.js';
import { AiwinsService } from './aiwins.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [AiwinsController],
  providers: [AiwinsService],
  exports: [AiwinsService],
})
export class AiwinsModule {}
