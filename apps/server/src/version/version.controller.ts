import { Controller, Get } from '@nestjs/common';

export interface AppVersionResponse {
  latestVersion: string;
  latestVersionCode: number;
  minSupportedVersionCode: number;
  title: string;
  message: string;
  forceMessage: string;
  storeUrl: string;
  webStoreUrl: string;
  releaseNotes: string[];
}

@Controller(['api/app-version', 'api/version'])
export class VersionController {
  @Get()
  getVersion(): AppVersionResponse {
    const latestVersionCode = Number(process.env.LATEST_VERSION_CODE || 21);
    const minSupportedVersionCode = Number(
      process.env.MIN_SUPPORTED_VERSION_CODE || 15
    );
    const latestVersion = process.env.LATEST_VERSION_NAME || '1.0.8';

    return {
      latestVersion,
      latestVersionCode,
      minSupportedVersionCode,
      title: "What's New in DuoOrb",
      message:
        process.env.UPDATE_MESSAGE ||
        'Ultra-fast connections, smarter bots, and performance improvements.',
      forceMessage:
        process.env.UPDATE_FORCE_MESSAGE ||
        'A critical update is required to continue playing DuoOrb online.',
      storeUrl: 'market://details?id=com.asdigital.duoorb',
      webStoreUrl: 'https://play.google.com/store/apps/details?id=com.asdigital.duoorb',
      releaseNotes: [
        'Instant connection & ultra-fast reconnects',
        'Dedicated high-speed servers (api.duoorb.com)',
        'Smarter AI pathfinding & tactical wall placement in Center Rush and Race modes',
        'Direct Match Analysis from Match History & Opponent Profiles',
        'Android 15 (16 KB page size) full native compatibility and optimizations',
      ],
    };
  }
}

