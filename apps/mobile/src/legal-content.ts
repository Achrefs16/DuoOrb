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

export const LEGAL_VERSION = '2026-10-01';
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
    updated: 'Last updated: 2026-10-01',
    intro: 'DuoOrb by AS Digital. The app talks to our game server for accounts, matchmaking, friends, history and ratings. Auth is via Supabase (Google + guest sessions).',
    sections: [
      {
        heading: 'Data we collect',
        body: 'Account: user ID, username (@handle), display name, email (Google accounts only). Content you create: bio (280 chars max), avatar URL, badge showcase. Game activity: matches, moves, results, Glicko-2 rating, achievements, AI wins. Social: friend requests, friendships, blocks. Diagnostics: hashed IP (SHA-256 for guest rate limiting), user-agent, crash logs. We do NOT collect location, contacts, camera, microphone, files or ad IDs. No chat, no ad SDK.',
      },
      {
        heading: 'How we use it',
        body: 'Sign-in and player identity, gameplay and matchmaking, leaderboards and ratings, friends/challenges/rooms, safety (rate limiting, replay detection, cheat validation) and support. Never sold, never used for third-party advertising.',
      },
      {
        heading: 'Sharing',
        body: 'Processors only: Supabase (auth) and our game server/database host (rows needed to run the service). No advertisers or brokers. Match reactions are ephemeral and never stored.',
      },
      {
        heading: 'Security',
        body: 'HTTPS/WSS in transit. Guest refresh tokens stored only as hashes and rotated every refresh; replays revoke the session. No passwords handled by us (Google OAuth via Supabase).',
      },
      {
        heading: 'Retention',
        body: 'Kept while the account exists. Guest sessions expire after 180 days idle. Deleting the account removes profile, ratings, history links, friends, blocks, AI wins, achievements and sessions. Finished game rows may remain without your seat so opponents keep history. Backups age out within 90 days.',
      },
      {
        heading: 'Your rights & deletion',
        body: 'Edit name/handle/bio/avatar in Settings anytime. Delete anytime: Settings > Danger Zone > Delete account & data, or email digitalas.support@gmail.com with subject "Delete my DuoOrb account" (include @handle or account email). Done within 30 days. Full steps are in the Delete screen.',
      },
      {
        heading: 'Children',
        body: 'Not directed at under-13s. Contact us if you believe a child provided data and we will delete it.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: 'Last updated: 2026-10-01',
    intro: 'Local AI, pass-and-play and online ranked matches on one universal Glicko-2 rating. No real-money gambling, loot boxes, ads or purchases.',
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
        body: 'Use Block on friends/profiles and Report where shown (profiles, history opponents, friend rows). Reports are reviewed and can lead to removal, warnings or bans. Urgent: digitalas.support@gmail.com with @handle, user ID and what happened. Match reactions are a fixed emoji set, ephemeral, never stored.',
      },
      {
        heading: 'Fair play',
        body: 'Server is authoritative and forces ranked status - it cannot be spoofed. Farming with colluding accounts, win-trading, bots or exploiting bugs is prohibited and can reset ratings or ban. Hard-AI wins are verified by replay before badges grant.',
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
    intro: 'Two ways to delete. Both permanently remove profile, rating, history links, friends, blocks, AI wins, achievements and sessions.',
    sections: [
      {
        heading: 'In the app (fastest)',
        body: 'Profile tab > Settings (gear) > Danger Zone > Delete account & data > confirm twice. Works for guests and Google accounts. The device signs out and wipes credentials immediately.',
      },
      {
        heading: 'Web / email (no app needed)',
        body: 'Email digitalas.support@gmail.com with subject "Delete my DuoOrb account". Include your account email OR your @handle + user ID (Profile > Settings shows both). We confirm and finish within 30 days. If law requires keeping something (fraud, security), we state exactly what and why.',
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
