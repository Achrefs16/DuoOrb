import { Controller, Get, Header } from '@nestjs/common';

/**
 * Serves the IAB app-ads.txt file at the domain root so AdMob can verify
 * app ownership (anti-fraud + revenue protection).
 *
 * Required at EXACTLY /app-ads.txt (not under /legal/*) on the domain listed
 * as Website in the Play store listing. Public route, no auth — same pattern
 * as LegalController. Content is tied to the AdMob account (pub-ID line) and
 * never changes when the domain changes; only the Play listing Website field
 * needs updating in that case.
 */
@Controller()
export class AdsTxtController {
  @Get('app-ads.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  appAdsTxt(): string {
    return 'google.com, pub-6057010656402010, DIRECT, f08c47fec0942fa0';
  }
}
