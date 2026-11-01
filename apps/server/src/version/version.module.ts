import { Module } from '@nestjs/common';
import { VersionController } from './version.controller.js';

@Module({
  controllers: [VersionController],
  exports: [],
})
export class VersionModule {}

