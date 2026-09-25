import { describe, expect, it } from 'vitest';
import { UsersService } from '../src/users/users.service.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Guest link', () => {
  it('refuses to merge without a database rather than corrupting data', async () => {
    const prisma = new PrismaService();
    prisma.isConnected = false;
    const service = new UsersService(prisma);

    const res = await service.linkGuest('account-1', 'u_guest1');
    expect(res.merged).toBe(false);
  });
});
