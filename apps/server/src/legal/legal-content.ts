/**
 * Canonical legal copy for DuoOrb.
 *
 * These strings are served as standalone HTML pages by LegalController
 * (`GET /legal/privacy`, `/legal/terms`, `/legal/delete-account`) so the
 * Play Console privacy-policy URL, Data Safety deletion link, and the
 * in-app Settings/Welcome links all resolve to the same public documents
 * without requiring a login.
 *
 * Keep the mobile markdown copies in sync by hand when this changes:
 * the text here is the source of truth for review.
 */

function contactEmail(): string {
  return process.env.LEGAL_CONTACT_EMAIL?.trim() || 'digitalas.support@gmail.com';
}

function baseUrl(): string {
  return (
    process.env.PUBLIC_WEB_URL?.trim() ||
    process.env.PUBLIC_BASE_URL?.trim() ||
    'https://duoorbapi.duckdns.org'
  ).replace(/\/$/, '');
}

function shell(title: string, body: string): string {
  const email = contactEmail();
  const base = baseUrl();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} - DuoOrb</title>
<style>
:root { color-scheme: light; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #faf8ff; margin: 0; }
main { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; background: #fff; }
h1 { font-size: 28px; margin: 0 0 4px; }
.updated { color: #64748b; font-size: 13px; margin-bottom: 24px; }
h2 { font-size: 18px; margin-top: 28px; }
a { color: #2563eb; }
nav { margin: 16px 0 24px; font-size: 14px; }
nav a { margin-right: 16px; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
footer { margin-top: 40px; font-size: 13px; color: #64748b; }
code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
<main>
<nav><a href="${base}/legal/privacy">Privacy Policy</a><a href="${base}/legal/terms">Terms of Service</a><a href="${base}/legal/delete-account">Delete Account &amp; Data</a></nav>
${body}
<footer>
<p>DuoOrb by AS Digital &mdash; ${title}. Contact: <a href="mailto:${email}">${email}</a>.</p>
<p>Canonical URLs:<br/>
<code>${base}/legal/privacy</code><br/>
<code>${base}/legal/terms</code><br/>
<code>${base}/legal/delete-account</code></p>
</footer>
</main>
</body>
</html>`;
}

export function privacyHtml(): string {
  const email = contactEmail();
  return shell(
    'Privacy Policy',
    `<h1>Privacy Policy</h1>
<div class="updated">Last updated: 2026-10-05. Applies to DuoOrb for Android (package com.asdigital.duoorb) and the DuoOrb game server.</div>

<h2>1. Who we are</h2>
<p>DuoOrb is a tactical grid-strategy game by AS Digital. The mobile app talks to our authoritative game server for accounts, matchmaking, friends, history and ratings. Authentication is provided by Supabase Auth (Google sign-in and guest sessions minted by our server). Free play shows Google AdMob ads; DuoOrb Premium (sold through Google Play) removes them. Contact: <a href="mailto:${email}">${email}</a>.</p>

<h2>2. Data we collect</h2>
<table>
<tr><th>Category</th><th>Examples</th><th>Purpose</th></tr>
<tr><td>Account identifiers</td><td>User ID, username (@handle), display name, email (Google accounts only)</td><td>Account management, sign-in, player identity in matches</td></tr>
<tr><td>Player content (UGC)</td><td>Bio (max 280 chars), avatar URL, badge showcase</td><td>Profile display, social features</td></tr>
<tr><td>Game activity</td><td>Match history, moves, results, ratings (Glicko-2), achievements, AI wins</td><td>Gameplay, leaderboards, fair play / anti-cheat, progress</td></tr>
<tr><td>Social graph</td><td>Friend requests, friendships, blocks</td><td>Friends, challenges, blocking</td></tr>
<tr><td>Premium status</td><td>Whether Premium is active and when it expires (from Google Play via RevenueCat; we never receive card or payment details)</td><td>Unlocking Premium features</td></tr>
<tr><td>Diagnostics</td><td>Hashed IP (SHA-256, for guest rate limiting), user-agent, crash/error logs</td><td>Security, abuse prevention, stability</td></tr>
<tr><td>Advertising (AdMob)</td><td>Advertising ID, approximate location, ad-interaction data, collected by Google under its own Privacy Policy</td><td>Serving banner and rewarded ads to free players</td></tr>
</table>
<p>We do <strong>not</strong> collect precise location, contacts, camera, microphone, or files. There is no in-game chat.</p>

<h2>3. How we use data</h2>
<p>Account management, gameplay and matchmaking, leaderboards and ratings, friends/challenges/rooms, Premium entitlement, safety (rate limiting, replay detection, cheat validation), and support. Free players see banner and rewarded ads; Premium members see none. We never sell personal data and never share it with data brokers.</p>

<h2>4. Sharing</h2>
<p>Processors only: (a) Supabase (authentication - email, auth tokens), (b) hosting provider for the game server / database (account, game and social rows needed to run the service), (c) Google AdMob (advertising ID and ad-interaction data, under Google's policies), (d) Google Play Billing via RevenueCat (subscription status only - no payment details touch our servers). No data is shared with data brokers. Reactions during matches are ephemeral and never stored.</p>

<h2>5. Security &amp; encryption</h2>
<p>All client-server traffic uses HTTPS (TLS) / WSS. Passwords are never handled by us (Google OAuth via Supabase). Guest refresh tokens are stored only as SHA-256 hashes and rotate on every refresh; replayed tokens revoke the session. Access is limited to what is needed to operate the game.</p>

<h2>6. Retention</h2>
<p>Accounts, profiles, game history, ratings and social rows are kept while the account exists so progress and fair-play records persist. Guest sessions expire after 180 days of inactivity and are purged. When you delete your account (in-app <strong>Settings &gt; Delete account</strong> or the web request below) we delete the User row and everything that cascades from it: profile, ratings, rating history, game-player links, friend requests, friendships, blocks, AI wins, achievements, badge slots and guest sessions. Finished Game rows may remain without your player link so opponents' histories stay consistent. Backups age out within 90 days. We may retain minimal logs required for security, fraud prevention or legal compliance and will disclose that in response to a request.</p>

<h2>7. Your rights &amp; deletion</h2>
<p>You can edit your display name, username, bio and avatar at any time in Settings. You can request access, correction, export or deletion of your data at any time:</p>
<ul>
<li><strong>In-app:</strong> Settings &gt; Delete account &amp; data (signed-in or guest). This calls <code>DELETE /api/me</code> and wipes local credentials immediately.</li>
<li><strong>Web (no reinstall needed):</strong> follow <a href="${baseUrl()}/legal/delete-account">Delete Account &amp; Data</a> or email <a href="mailto:${email}">${email}</a> from the address on the account (or include your @handle + user ID from Profile &gt; Settings) with subject "Delete my DuoOrb account". We confirm and complete deletion within 30 days.</li>
</ul>
<p>See Data Safety &gt; Data deletion on Google Play for the same links.</p>

<h2>8. Children</h2>
<p>DuoOrb is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child provided data, contact us and we will delete it. Parents may request review or deletion at <a href="mailto:${email}">${email}</a>.</p>

<h2>9. Changes</h2>
<p>We will update this page and the in-app links when practices change. Material changes will be noted here with a new date before taking effect.</p>`
  );
}

export function termsHtml(): string {
  const email = contactEmail();
  return shell(
    'Terms of Service',
    `<h1>Terms of Service</h1>
<div class="updated">Last updated: 2026-10-05.</div>

<h2>1. The game</h2>
<p>DuoOrb provides local AI, pass-and-play, and online ranked matches with matchmaking, rooms, friends, challenges and leaderboards. Online games are ranked on one universal Glicko-2 rating. There is no real-money gambling and no loot boxes. Free play is ad-supported; DuoOrb Premium removes ads and unlocks extras (section 6 below).</p>

<h2>2. Accounts</h2>
<p>You may play as a guest (progress stays on the server under a guest ID) or sign in with Google. One person, one account; do not share credentials or impersonate others. You must be at least 13 years old (or the minimum age in your country) to create an account. Guest progress can be merged once into a signed-in account via Settings; the merge is one-shot.</p>

<h2>3. Acceptable use &amp; user content</h2>
<p>Usernames (lowercase letters, numbers, _ - 3-24 chars), display names, bios and avatars are user-generated content. By creating or uploading any of it you agree:</p>
<ul>
<li>No hate, harassment, sexual content involving minors, threats, doxxing, spam, or illegal content.</li>
<li>No impersonation of other players, staff, or brands; no misleading handles.</li>
<li>Avatars must be lawful images you have the right to use; no explicit or hateful imagery.</li>
<li>We may rename, hide or remove violating handles, names, bios or avatars and suspend repeat offenders.</li>
</ul>

<h2>4. Reporting &amp; blocking</h2>
<p>The app provides Block and Report on profiles. Reports are reviewed and may lead to content removal, warnings, suspensions or bans. For urgent issues email <a href="mailto:${email}">${email}</a> with the @handle, user ID, and what happened. Reactions in matches are limited to a fixed emoji set, are ephemeral, and are not stored.</p>

<h2>5. Fair play</h2>
<p>The server is authoritative: clients submit moves, the server validates them and broadcasts state. Ranked status is forced server-side and cannot be spoofed as casual. Farming ratings with colluding accounts, win-trading, exploiting bugs, or using bots/scripts is prohibited and may lead to rating resets or bans. Hard-AI wins are verified by replaying notation before any badge is granted.</p>

<h2>6. Premium subscriptions</h2>
<p>DuoOrb Premium ($3.99/month or $24.99/year; prices vary by country) removes all ads and unlocks unlimited game analysis, exclusive bots, the Midnight board theme and the Premium profile badge. Both plans start with a 7-day free trial, then bill automatically each period until cancelled. Billing is handled entirely by Google Play: we never receive payment details. Cancel any time in the app under Settings &gt; Premium &gt; Manage subscription (or Play Store &gt; Payments &amp; subscriptions); access continues until the end of the paid period. Refunds follow Google Play policy. Promotional prices, if offered, renew at the standard rate stated at purchase. Guests must save with Google before purchasing so Premium attaches to an account. Deleting your DuoOrb account does <strong>not</strong> cancel billing - cancel the subscription separately first.</p>

<h2>7. Availability</h2>
<p>Online features require a connection and may be interrupted for maintenance. We may change, suspend or discontinue features. Guest sessions expire after 180 days of inactivity.</p>

<h2>8. Termination &amp; deletion</h2>
<p>You may delete your account at any time via Settings &gt; Delete account or the <a href="${baseUrl()}/legal/delete-account">web deletion page</a>. Deleting the account does <strong>not</strong> cancel a Premium subscription - cancel it separately first (Settings &gt; Premium &gt; Manage subscription), otherwise billing continues. We may suspend or terminate accounts that violate these terms. Termination deletes or disables access as described in the Privacy Policy.</p>

<h2>9. Liability</h2>
<p>The game is provided "as is" without warranties to the maximum extent permitted by law. To the extent permitted by law our liability is limited to the amounts you paid for the service (free players who never subscribed: $0).</p>

<h2>10. Contact</h2>
<p>Questions about these terms: <a href="mailto:${email}">${email}</a>.</p>`
  );
}

export function deleteAccountHtml(): string {
  const email = contactEmail();
  const base = baseUrl();
  return shell(
    'Delete Account & Data',
    `<h1>Delete your DuoOrb account &amp; data</h1>
<div class="updated">You do <strong>not</strong> need to reinstall the app to request deletion.</div>

<h2>Option A - In the app (fastest)</h2>
<ol>
<li>Open DuoOrb &gt; <strong>Profile tab &gt; Settings (gear)</strong>.</li>
<li>Scroll to <strong>Danger Zone &gt; Delete account &amp; data</strong>.</li>
<li>Confirm twice. The app calls <code>DELETE ${base}/api/me</code>, deletes your User row and everything linked to it, signs you out, and wipes credentials on the device.</li>
</ol>
<p>Works for both guests and Google accounts. If you are signed in with Google, also sign out of Google in the device browser if the browser kept a session - we delete the DuoOrb rows and request Supabase Auth user deletion.</p>

<h2>Option B - Web request (no app needed)</h2>
<p>Email <a href="mailto:${email}?subject=${encodeURIComponent('Delete my DuoOrb account')}">${email}</a> with subject "Delete my DuoOrb account" and include either:</p>
<ul>
<li>the email address on the Google account, <strong>or</strong></li>
<li>your @handle + user ID (Profile &gt; Settings shows both),</li>
</ul>
<p>plus "Please delete my DuoOrb account and all associated data". We reply to confirm and complete deletion within <strong>30 days</strong>. If retention is legally required (fraud, security, compliance) we will state exactly what is kept and why.</p>

<h2>What gets deleted</h2>
<ul>
<li>User row + profile (username, display name, bio, avatar), ratings + rating history</li>
<li>Game-player links, friend requests, friendships, blocks</li>
<li>AI wins, achievements, equipped badges, guest sessions + tokens</li>
<li>Premium status and subscription records on our side</li>
<li>Local credentials on the device (on in-app deletion)</li>
</ul>
<p><strong>Important:</strong> deleting your account does <strong>not</strong> cancel a DuoOrb Premium subscription - cancel it separately first in the app (Settings &gt; Premium &gt; Manage subscription) or in Play Store &gt; Payments &amp; subscriptions, otherwise Google Play keeps billing.</p>
<p>Finished Game rows may remain without your seat so opponents' records stay intact. Backups age out within 90 days.</p>

<h2>Questions</h2>
<p><a href="mailto:${email}">${email}</a> - Privacy: <a href="${base}/legal/privacy">${base}/legal/privacy</a> - Terms: <a href="${base}/legal/terms">${base}/legal/terms</a>.</p>`
  );
}

export function legalIndexHtml(): string {
  const base = baseUrl();
  return shell(
    'Legal',
    `<h1>DuoOrb Legal</h1>
<div class="updated">Public documents for players and store review. No login required.</div>
<ul>
<li><a href="${base}/legal/privacy">Privacy Policy</a></li>
<li><a href="${base}/legal/terms">Terms of Service</a></li>
<li><a href="${base}/legal/delete-account">Delete Account &amp; Data</a></li>
</ul>`
  );
}

export function legalUrls(): { base: string; privacy: string; terms: string; deleteAccount: string; contact: string } {
  const base = baseUrl();
  return {
    base,
    privacy: `${base}/legal/privacy`,
    terms: `${base}/legal/terms`,
    deleteAccount: `${base}/legal/delete-account`,
    contact: contactEmail(),
  };
}
