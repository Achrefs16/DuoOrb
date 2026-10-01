import { Controller, Get, Header } from '@nestjs/common';
import {
  deleteAccountHtml,
  legalIndexHtml,
  legalUrls,
  privacyHtml,
  termsHtml,
} from './legal-content.js';

@Controller('legal')
export class LegalController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(): string {
    return legalIndexHtml();
  }

  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  privacy(): string {
    return privacyHtml();
  }

  @Get('terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  terms(): string {
    return termsHtml();
  }

  @Get('delete-account')
  @Header('Content-Type', 'text/html; charset=utf-8')
  deleteAccount(): string {
    return deleteAccountHtml();
  }

  @Get('urls')
  urls() {
    return legalUrls();
  }
}
