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
    const latestVersionCode = Number(process.env.LATEST_VERSION_CODE || 18);
    const minSupportedVersionCode = Number(
      process.env.MIN_SUPPORTED_VERSION_CODE || 15
    );
    const latestVersion = process.env.LATEST_VERSION_NAME || '1.0.5';

    return {
      latestVersion,
      latestVersionCode,
      minSupportedVersionCode,
      title: "What's New in DuoOrb",
      message:
        process.env.UPDATE_MESSAGE ||
        'Smarter bots, enhanced review analysis, and performance improvements.',
      forceMessage:
        process.env.UPDATE_FORCE_MESSAGE ||
        'A critical update is required to continue playing DuoOrb online.',
      storeUrl: 'market://details?id=com.asdigital.duoorb',
      webStoreUrl: 'https://play.google.com/store/apps/details?id=com.asdigital.duoorb',
      releaseNotes: [
        'Smarter AI pathfinding & tactical wall placement in Center Rush and Race modes',
        'Direct Match Analysis from Match History & Opponent Profiles',
        'Bot Unlock preview showcase with custom avatars',
        'Android 15 (16 KB page size) full native compatibility and optimizations',
      ],
    };
  }
}

