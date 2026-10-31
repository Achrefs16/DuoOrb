/**
 * Native in-app legal copy (DuoOrb by AS Digital).
 *
 * This mirrors the hosted web pages served at GET /legal/* (see
 * apps/server/src/legal/legal-content.ts) but in a structure the native
 * LegalScreen can render without a browser. The web pages remain the
 * canonical Play Console URLs; this is the offline-capable in-app copy.
 *
 * Bump LEGAL_VERSION when the meaning changes - onboarding re-asks
 * acceptance for the new version.
 */

export const LEGAL_VERSION = '2026-10-31';
export const LEGAL_DEVELOPER = 'AS Digital';

export type LegalKind = 'privacy' | 'terms' | 'delete';

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: Record<LegalKind, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: 2026-10-31',
    intro: 'DuoOrb by AS Digital. The app talks to our game server for accounts, matchmaking, rooms, friends, history, cosmetics and ratings. Auth is via Supabase (Google + guest sessions). Post-game engine analysis runs locally on your device. Free play shows Google AdMob ads; DuoOrb Premium (via Google Play) removes them.',
    sections: [
      {
        heading: 'Data we collect',
        body: 'Account: user ID, username (@handle), display name, email (Google accounts only). Content & customization: bio (280 chars max), avatar URL, badge showcase, equipped Ball & Wall cosmetic skins. Game activity: matches, moves, results, Glicko-2 rating (Classical 1v1), achievements, AI wins, bot mastery stars (1\u20133 stars) and unlocked bots. Social: friend requests, friendships, blocks, room participation. Premium status: whether Premium is active and when it expires (from Google Play via RevenueCat \u2014 we never see card or payment details). Diagnostics: hashed IP (SHA-256 for guest rate limiting), user-agent, crash logs. Advertising: Google AdMob may collect your advertising ID, approximate location and ad-interaction data to serve banner, interstitial and optional rewarded video ads, under Google\u2019s own Privacy Policy. We do NOT collect precise location, contacts, camera, microphone or files. No free-form chat.',
      },
      {
        heading: 'How we use it',
        body: 'Sign-in and player identity, gameplay and matchmaking, leaderboards and ratings, friends/challenges/rooms, syncing equipped cosmetics and bot progress, Premium entitlement (unlocking no-ads, unlimited analysis, all 39 bots, all 16 cosmetic sets, 9 Hints & 9 Undos per bot match, and the subscriber diamond badge), safety (rate limiting, replay detection, cheat validation) and support. Post-game engine match review is computed locally on your device. Free players see banner/interstitial ads and may optionally watch rewarded video ads for extra Hints, Undos, ad-tier Bot unlocks or extra Match Reviews; Premium members see no ads. Never sold, never shared with data brokers.',
      },
      {
        heading: 'Sharing',
        body: 'Processors only: Supabase (auth), our game server/database host (rows needed to run the service), Google AdMob (advertising ID and ad-interaction data, under Google\u2019s policies), and Google Play Billing via RevenueCat (subscription status only). Match reactions are ephemeral and never stored.',
      },
      {
        heading: 'Security',
        body: 'HTTPS/WSS in transit. Guest refresh tokens stored only as hashes and rotated every refresh; replays revoke the session. No passwords handled by us (Google OAuth via Supabase).',
      },
      {
        heading: 'Retention',
        body: 'Kept while the account exists. Guest sessions expire after 180 days idle. Deleting the account removes profile, ratings, history links, friends, blocks, AI wins, bot stars, achievements and sessions. Finished game rows may remain without your seat so opponents keep history. Backups age out within 90 days.',
      },
      {
        heading: 'Your rights & deletion',
        body: 'Edit name/handle/bio/avatar in Settings anytime. Delete anytime: Settings > Danger Zone > Delete account & data, or email support@duoorb.com with subject "Delete my DuoOrb account" (include @handle or account email). Done within 30 days. Full steps are in the Delete screen.',
      },
      {
        heading: 'Children',
        body: 'Not directed at under-13s. Contact us if you believe a child provided data and we will delete it.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: 'Last updated: 2026-10-31',
    intro: 'Local AI, pass-and-play and online matches (Classical 1v1 ranked on one universal Glicko-2 rating; Center Rush and Race casual). No real-money gambling or loot boxes. Free play is ad-supported; DuoOrb Premium removes ads and unlocks all extras (details below).',
    sections: [
      {
        heading: 'Accounts',
        body: 'Guest or Google sign-in. One person, one account. 13+ (or minimum age in your country). Guest progress merges once into a signed-in account.',
      },
      {
        heading: 'User content rules',
        body: 'Usernames (a-z 0-9 _ , 3-24 chars), display names, bios and avatars are yours but must follow the rules: no hate, harassment, threats, sexual content involving minors, doxxing, spam or illegal content. No impersonation. Avatars must be lawful images you may use. We may rename, hide or remove violating content and suspend repeat offenders.',
      },
      {
        heading: 'Reporting & blocking',
        body: 'Use Block on profiles and Report where shown (profiles). Reports are reviewed and can lead to removal, warnings or bans. Urgent: support@duoorb.com with @handle, user ID and what happened. Match reactions are a fixed emoji set, ephemeral, never stored.',
      },
      {
        heading: 'Fair play',
        body: 'Server is authoritative and forces ranked status - it cannot be spoofed. Farming with colluding accounts, win-trading, bots or exploiting bugs is prohibited and can reset ratings or ban. AI wins and bot stars are verified before badges grant.',
      },
      {
        heading: 'Premium subscriptions',
        body: 'DuoOrb Premium ($3.99/month or $24.99/year, prices vary by country) removes all ads and unlocks unlimited Engine Match Analysis, all 39 AI Bots, all 16 Ball & Wall Cosmetic sets, 9 Hints & 9 Undos per bot match, and the subscriber Diamond badge. Both plans start with a 7-day free trial, then bill automatically each period until cancelled. Billing is handled entirely by Google Play: we never see payment details. Cancel anytime in Settings > Premium > Manage subscription (or Play Store > Payments & subscriptions); access continues until the end of the paid period. Refunds follow Google Play policy. Promotional prices, if offered, renew at the standard rate stated at purchase. Guests must save with Google before purchasing so Premium attaches to an account.',
      },
      {
        heading: 'Availability & termination',
        body: 'Online needs a connection and may pause for maintenance. Guests expire after 180 days idle. You may delete anytime (Delete screen). We may suspend violators.',
      },
    ],
  },
  delete: {
    title: 'Delete Account & Data',
    updated: 'No reinstall needed for a web request.',
    intro: 'Two ways to delete. Both permanently remove profile, rating, history links, friends, blocks, AI wins, achievements, Premium status and sessions. IMPORTANT: deleting your account does NOT cancel Premium billing — cancel first in Settings > Premium > Manage subscription (or Play Store > Payments & subscriptions).',
    sections: [
      {
        heading: 'In the app (fastest)',
        body: 'Profile tab > Settings (gear) > Danger Zone > Delete account & data > confirm twice. Works for guests and Google accounts. The device signs out and wipes credentials immediately.',
      },
      {
        heading: 'Web / email (no app needed)',
        body: 'Email support@duoorb.com with subject "Delete my DuoOrb account". Include your account email OR your @handle + user ID (Profile > Settings shows both). We confirm and finish within 30 days. If law requires keeping something (fraud, security), we state exactly what and why.',
      },
      {
        heading: 'What remains',
        body: 'Finished game rows may stay without your seat so opponents keep records. Backups age out within 90 days.',
      },
    ],
  },
};

export function legalTitle(kind: LegalKind): string {
  return LEGAL_DOCS[kind].title;
}
