import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FriendsService } from './friends.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/auth.service.js';

@Controller('api/friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  async getFriends(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.getFriends(user.id);
  }

  @Get('requests')
  async getRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.getRequests(user.id);
  }

  @Post('request')
  async sendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { toUserId?: string; toUsername?: string }
  ) {
    return this.friendsService.sendRequest(user.id, body);
  }

  @Post('request/:id/respond')
  async respondRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') requestId: string,
    @Body() body: { accept: boolean }
  ) {
    return this.friendsService.respondRequest(user.id, requestId, body.accept);
  }

  @Delete(':friendId')
  async removeFriend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('friendId') friendId: string
  ) {
    return this.friendsService.removeFriend(user.id, friendId);
  }

  @Post('block/:userId')
  async blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') targetUserId: string
  ) {
    return this.friendsService.blockUser(user.id, targetUserId);
  }
}
