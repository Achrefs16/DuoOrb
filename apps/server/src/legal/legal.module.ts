import { Module } from '@nestjs/common';
import { AdsTxtController } from './ads-txt.controller.js';
import { LegalController } from './legal.controller.js';

@Module({
  controllers: [AdsTxtController, LegalController],
})
export class LegalModule {}
