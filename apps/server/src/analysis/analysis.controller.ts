import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service.js';
import { ReviewRequestDto } from './dto/review-request.dto.js';

@Controller('api/analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * Request full match analysis powered by the native Rust engine.
   * Runs asynchronously off the main thread; results are cached.
   */
  @Post('review')
  @HttpCode(HttpStatus.OK)
  async reviewGame(@Body() body: ReviewRequestDto) {
    return this.analysisService.reviewGame(
      body?.initialState,
      body?.history,
      body?.gameId,
      body?.mode
    );
  }

  /**
   * Fetch cached analysis for a given game ID.
   */
  @Get(':gameId')
  async getCachedReview(@Param('gameId') gameId: string) {
    return this.analysisService.getCachedReview(gameId);
  }
}
