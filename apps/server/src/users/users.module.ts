import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AiwinsModule } from '../aiwins/aiwins.module.js';

@Module({
  imports: [AuthModule, AiwinsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
