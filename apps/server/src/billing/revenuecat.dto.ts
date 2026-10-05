import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * RevenueCat webhook v1 event envelope. Only the fields we act on are
 * modeled; the global ValidationPipe (whitelist:true) strips the rest.
 * `app_user_id` MUST be the DuoOrb userId — the mobile client sets it as the
 * RevenueCat App User ID on every configure() (P2.2).
 */
export class RevenueCatEventDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsString()
  app_user_id!: string;

  @IsOptional()
  @IsString()
  product_id?: string;

  @IsOptional()
  @IsNumber()
  expiration_at_ms?: number;

  @IsOptional()
  @IsNumber()
  event_timestamp_ms?: number;
}

export class RevenueCatWebhookDto {
  @ValidateNested()
  @Type(() => RevenueCatEventDto)
  event!: RevenueCatEventDto;
}
