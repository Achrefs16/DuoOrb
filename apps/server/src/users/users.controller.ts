import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/auth.service.js';

@Controller('api')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { displayName?: string; username?: string; bio?: string; avatarUrl?: string }
  ) {
    return this.usersService.updateProfile(user.id, body);
  }

  @Get('profiles/:userId')
  async getProfile(@Param('userId') userId: string) {
    return this.usersService.getPublicProfile(userId);
  }

  @Get('users/username-available')
  @UseGuards(JwtAuthGuard)
  async usernameAvailable(
    @CurrentUser() user: AuthenticatedUser,
    @Query('username') username: string
  ) {
    return this.usersService.isUsernameAvailable(username, user.id);
  }

  @Get('users/search')
  @UseGuards(JwtAuthGuard)
  async searchUsers(@Query('q') query: string) {
    return this.usersService.searchUsers(query);
  }

  /**
   * One-shot guest merge: adopts a never-authenticated guest row
   * (ratings, friendships, game history) into the signed-in account,
   * then removes the guest row. Only `u_*` guest ids are linkable,
   * so real accounts can never be hijacked through this route.
   */
  @Post('link')
  @UseGuards(JwtAuthGuard)
  async linkGuest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { guestId?: string }
  ) {
    if (!body?.guestId || !/^u_[a-z0-9]+$/.test(body.guestId)) {
      throw new BadRequestException('Only guest accounts can be linked.');
    }
    if (body.guestId === user.id) {
      throw new BadRequestException('Cannot link an account to itself.');
    }
    return this.usersService.linkGuest(user.id, body.guestId);
  }
}
