import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public isConnected = false;

  constructor() {
    super({
      // Production previously logged only 'error', which is why a systemic
      // failure (a foreign-key violation repeated on every socket connect) sat
      // invisible in the application log while the only trace was Prisma's bare
      // "prisma:error" line with no context. 'warn' costs nothing at this
      // request volume and surfaces degraded connections early.
      log:
        process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('Connected to PostgreSQL database successfully.');
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(`PostgreSQL connection failed: ${err.message}. Operations requiring database will be unavailable or gracefully degraded until database is connected.`);
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }
}
