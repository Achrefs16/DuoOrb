To make DuoOrb ([https://duoorb.com](https://duoorb.com)) pass Google AdSense review on the first submission while outranking established board-game portals on Google Search and AI answer engines (ChatGPT Search, Perplexity, Gemini, Claude), you need a structural shift in how apps/mobile/public/ is organized.

Right now, your site has a great visual shell (css/style.css is clean, fast, and editorial) and an impressive underlying engine (duoorb-rust-mcts-2.0), but your web content layer has four fatal vulnerabilities that block both AdSense approval and top-tier search rankings:

AdSense "Low Value / Under Construction" Triggers: Six of your 11 pages have fewer than 300 words (play.html has 50, cookies.html has 68, contact.html has 80), yet all 11 pages load adsbygoogle.js. Worse, index.html and about.html state "Available now on Google Play", directly contradicting app.html ("Coming soon to Google Play"). AdSense human reviewers immediately reject sites with ad tags on thin utility pages or contradictory store availability claims.

60% Cross-Page Cannibalization: index.html, quoridor-online.html, what-is-the-game-with-two-balls-and-walls.html, app.html, and about.html repeat the exact same 4 basic rules and the same 6 feature blurbs. Search engines fold near-duplicate pages together rather than ranking them separately.

Factual Drift Against Engine Truth: Your HTML copy cites a "4-digit room code" (truth: 6-letter unambiguous code), "unlimited timers" (truth: 7 Fischer clock presets, 99-wall custom sandbox), only 3 bots on rules.html and app.html (truth: 7 personality bots from Martin 800 to Achref 2400 + 3 generic tiers), and "Official rules / Official Mobile App" (trademark risk).

Missing High-Volume Search & AI Intent Clusters: Competitors rank #1 because they have dedicated, deep pages for Strategy & Opening Theory (how to win, wall parity, the 3-space rule, opening traps) and AI Bots & Engine Architecture (MCTS playouts, branching factor, move grading formulas).

Below is your complete, step-by-step Web Architecture, AdSense Approval, SEO/GEO, and Copywriting Master Blueprint—strictly scoped to apps/mobile/public/ (plus one text sync in apps/server/src/legal/legal-content.ts) and using 100% your existing frozen css/style.css classes.

Part 1: Site Architecture Overhaul (Delete, Expand, & Add Pages)
Instead of 11 pages where half are thin or repetitive, restructure apps/mobile/public/ into 12 surgical URLs (deleting 1 doorway page, expanding 9 existing pages, and adding 2 high-traffic pillar pages).

Action	File in apps/mobile/public/	Target Words	AdSense Tag in Head?	Primary Search / AI Intent Cluster
DELETE + 301	play.html (Redirect to /)	0 (Deleted)	No	None — removes your #1 AdSense "Doorway Page" rejection risk.
EXPAND	index.html (#duoorb-home)	800+ words	Yes (inside overlay only)	duoorb, tactical 1v1 grid board game, free online wall & orb duel
REWRITE	quoridor-online.html	1,300+ words	Yes	play quoridor online free, quoridor multiplayer room code, quoridor with friends
REWRITE	rules.html	1,600+ words	Yes	quoridor rules, quoridor jump rules, 4 player wall count, quoridor notation
ADD NEW	strategy.html (NEW)	1,700+ words	Yes	quoridor strategy, how to win at quoridor, quoridor openings, wall parity
ADD NEW	bots-and-analysis.html (NEW)	1,350+ words	Yes	quoridor ai, quoridor bot difficulty, quoridor mcts solver, game review grades
REWRITE	what-is-the-game-with-two-balls-and-walls.html	950+ words	Yes	game with two balls and walls, board game with fences and marbles, corridor maze game
REWRITE	app.html	950+ words	Yes	quoridor mobile app, offline wall strategy game, install duoorb pwa
REWRITE	about.html	750+ words	No (Trust page)	duoorb as digital, who made duoorb, duoorb engineering & fair play
EXPAND	privacy.html	550+ words	No (Legal page)	GDPR/CCPA data table, Supabase/RevenueCat/AdSense processors, 180d guest retention
EXPAND	terms.html	550+ words	No (Legal page)	Fair play, server authority, Premium ($3.99/mo, $24.99/yr), refund/cancellation rules
EXPAND	cookies.html	450+ words	No (Legal page)	Explicit IAB TCF v2.3 & AdSense cookie declaration table (__gads, __gpi, FCNEC)
EXPAND	contact.html	400+ words	No (Support page)	Support SLA, Account Deletion protocol, Bug Report & Fair-Play Abuse templates
Crucial Navigation Update Across All Pages
Update .nav-links (and #mobile-nav-drawer + #duoorb-webnav + .site-footer) across all pages so your new pillar pages receive immediate internal PageRank:

Header Nav Links (.nav-links): Online (/quoridor-online.html) · Rules (/rules.html) · Strategy (/strategy.html) · AI & Analysis (/bots-and-analysis.html) · App (/app.html) · About (/about.html)

Primary CTA Button (.btn-pill-primary): Always links to / (and on index.html, uses href="/" with data-duoorb-play="true"—never /play.html).

Part 2: Google AdSense Approval Blueprint (Zero-Rejection Protocol)
AdSense rejections on web games happen for three reasons: un-gated EEA tracking, ad tags firing on utility/legal pages, and ads touching the interactive game canvas. Fix all three before requesting review:

1. Remove adsbygoogle.js from All Non-Editorial Pages
Delete the <script async src="[https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6057010656402010](https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6057010656402010)" crossorigin="anonymous"></script> line from the head section of:

about.html

privacy.html

terms.html

cookies.html

contact.html

Keep adsbygoogle.js only on your 7 deep editorial/content pages (index.html, quoridor-online.html, rules.html, strategy.html, bots-and-analysis.html, what-is-the-game-with-two-balls-and-walls.html, and app.html).

2. Implement Google Consent Mode v2 + Funding Choices CMP
In 2026, Google requires Google Consent Mode v2 (ad_storage, ad_user_data, ad_personalization, analytics_storage) for all EEA/UK/Swiss traffic.

Inside your Google AdSense Dashboard, go to Privacy & messaging → European regulations → Create message, enable the Google-certified IAB TCF v2.3 CMP for duoorb.com, and publish it. (Because it is tied to your ca-pub-6057010656402010 tag, it requires zero custom CSS changes.)

On the 7 pages that load AdSense, place this Consent Mode v2 default-deny bootstrap immediately above the adsbygoogle.js tag in <head>:

HTML
<!-- Google Consent Mode v2 Bootstrap (EEA/UK/CH Safe Default) -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'regions': ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IS','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SI','SK','CH'],
    'wait_for_update': 500
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', false);
</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6057010656402010" crossorigin="anonymous"></script>
3. Protect index.html Game Canvas from Ad Overlay Violations
In index.html, #duoorb-home (z-index: 9000) sits above #root (the Expo game canvas). When a user clicks Play Now (showGame()), #duoorb-home is hidden.

Rule for AdSense Auto Ads & Manual Slots: In your AdSense dashboard under Ads → Overview → By site → Edit (duoorb.com), turn OFF Anchor ads and Side rail ads on duoorb.com (or exclude the URL pattern /?room=* and /?join=*). Why? Because if an AdSense anchor banner stays pinned over the bottom of #root while a user is playing a live match, it covers BottomNav (PLAY / FRIENDS / LEADERBOARD / HISTORY / PROFILE) and triggers an "Encouraging accidental clicks / Ads overlapping interactive game content" policy ban.

In index.html, modify showGame() so that when the player enters the arena, any ad containers inside #duoorb-home are cleanly unmounted from the viewport:

JavaScript
function showGame() {
  var home = document.getElementById('duoorb-home');
  if (home) {
    home.style.display = 'none';
    home.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.add('duoorb-playing');
  try { sessionStorage.setItem('duoorb-played', '1'); } catch (e) {}
}
4. Eliminate Every Store & Trademark Contradiction (P0 Fixes)
Before clicking "Request Review" in AdSense, run these exact searches across apps/mobile/public/:

Fix Store Contradiction: In index.html:506 and about.html:60, replace "Available now on Google Play. Coming soon to the App Store." with:
"Coming soon to Google Play and the Apple App Store. Play instantly in your browser or install the web app (PWA) today."

Fix "Official" Trademark Claim:

In rules.html:7 (meta description), change "official rules guide" to "complete illustrated rules and tactical handbook".

In rules.html:142 (<h1>), change "How to play DuoOrb and Quoridor: Complete official rules" to "How to Play DuoOrb & Quoridor: Complete Illustrated Rules & Tactics".

In app.html:87 (section eyebrow), change "Official Mobile App" to "DuoOrb Mobile & PWA Edition".

Part 3: Page-by-Page Rewrite & New Page Specifications
Every block below uses only your existing classes in apps/mobile/public/css/style.css (.section, .section-fog, .container, .grid-3, .grid-2, .card-neutral, .card-peach, .product-artifact, .editorial-table, .faq-grid, .btn-pill-primary, .btn-pill-ghost).

Page 1: / (public/index.html) — The Arena Shell & Editorial Hub
Target Word Count in #duoorb-home: ~800 visible words (up from ~300).

Technical Fixes in index.html
Theme Color Alignment: Change <meta name="theme-color" content="#F2F3FF"> to <meta name="theme-color" content="#FFFFFF"> (and update manifest.json theme_color to "#FFFFFF" and background_color to "#FAFAFB" so the light editorial paper design matches the PWA frame).

Replace /play.html Links: Change all three links pointing to href="/play.html" (:465, :487, :523) to href="/" with data-duoorb-play="true".

Wire Orphan Screenshot: Wire /screenshots/match-setup.png (width="300" height="650" loading="lazy") into a new visual breakdown section inside #duoorb-home.

Upgrade JSON-LD (:43-60): Add author and publisher (AS Digital) so Google links the WebApplication entity to your organization.

Expanded Copy to Add Inside #duoorb-home (Between the 6 Feature Cards and the Footer)
Keep your existing Hero (<h1>DuoOrb — the pure duel of wits. Play free in your browser.</h1>) and 6 cards (with Card 6 fixed to "Coming soon to Google Play and the Apple App Store. Play the PWA today."), then insert these two sections using your existing .section-fog and .editorial-table classes:

HTML
<section class="section section-fog">
  <div class="container">
    <p class="eyebrow">Arena Specifications</p>
    <h2>One 9×9 Grid. Four Distinct Competitive Formats.</h2>
    <p class="section-lead">Every match runs on a deterministic server-validated ruleset where pawn movement, groove geometry, and Breadth-First Search (BFS) path verification execute in real time.</p>
    <div class="table-wrap">
      <table class="editorial-table">
        <thead>
          <tr>
            <th>Game Mode</th>
            <th>Players</th>
            <th>Starting Coordinates</th>
            <th>Wall Budget</th>
            <th>Victory Condition</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Classic 1v1 Duel</strong></td>
            <td>2 Players</td>
            <td>Blue <code>(8,4)</code> vs Red <code>(0,4)</code></td>
            <td>10 walls per player (20 total)</td>
            <td>Reach any square on the opposite baseline row</td>
          </tr>
          <tr>
            <td><strong>4-Player Center Rush</strong></td>
            <td>4 Players</td>
            <td><code>(8,4)</code>, <code>(0,4)</code>, <code>(4,0)</code>, <code>(4,8)</code></td>
            <td>5 walls per player (20 total)</td>
            <td>First orb to occupy the golden center tile <code>(4,4)</code></td>
          </tr>
          <tr>
            <td><strong>Center Duel (2P / 3P)</strong></td>
            <td>2 or 3 Players</td>
            <td>Edge midpoints facing center</td>
            <td>10 each (2P) or 6 each (3P)</td>
            <td>Converge through a shared maze to capture <code>(4,4)</code></td>
          </tr>
          <tr>
            <td><strong>Baseline Sprint (Race 2–4P)</strong></td>
            <td>2 to 4 Players</td>
            <td>Spread across bottom row columns</td>
            <td>10 (2P), 6 (3P), or 5 (4P)</td>
            <td>All players race upward toward the top edge row</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="section">
  <div class="container grid-2">
    <div class="card-neutral">
      <p class="eyebrow">Deterministic Fairness</p>
      <h3>Zero RNG. Pure Spatial Calculation.</h3>
      <p>There are no dice rolls, hidden cards, or pay-to-win upgrades in DuoOrb. On a standard 9×9 board with an 8×8 internal wall lattice, every turn offers up to 4 pawn steps (or adjacent jump variations) and 128 candidate horizontal and vertical wall slots. Victory belongs strictly to the player who calculates shortest-path differentials and preserves wall tempo for the endgame.</p>
      <p><a href="/strategy.html" class="btn-pill btn-pill-ghost">Read the Opening &amp; Endgame Strategy Guide →</a></p>
    </div>
    <div class="product-artifact">
      <img src="/screenshots/match-setup.png" width="300" height="650" loading="lazy" alt="DuoOrb custom match setup screen showing wall budgets of 10, 15, or 99 walls and Fischer clock presets" />
      <div class="artifact-caption">
        <strong>Custom Arena Configuration</strong> — Select Classic 1v1, Center Rush, or Race modes, set wall budgets (10, 15, or 99 sandbox), and configure Fischer increment clocks before launching.
      </div>
    </div>
  </div>
</section>
Page 2: /quoridor-online.html — The Online Multiplayer & Matchmaking Guide
Target Word Count: ~1,300 words.
Job: Own every search query related to playing Quoridor online free, inviting friends via private rooms, time controls, and rated matchmaking. Remove generic rules repetition (link to /rules.html instead) and replace with deep operational specifics.

Bug Fixes on quoridor-online.html
Fix CLS on Line 185: Add width="300" height="650" to the second <img> tag, OR better yet, swap the duplicate gameplay-duel.png on line 185 for the orphaned /screenshots/modal-dialog.png (width="300" height="650" loading="lazy") so every image on the page is unique!

Shorten <title> for SERP Click-Through:
<title>Play Quoridor Online Free — 1v1 Rated &amp; Private Rooms | DuoOrb</title> (62 chars).

New Sections to Add to quoridor-online.html
Insert these sections before the FAQ block to push unique depth past 1,300 words:

HTML
<section class="section section-fog" id="time-controls">
  <div class="container">
    <p class="eyebrow">Server-Synced Clocks</p>
    <h2>Seven Fischer Time Controls for Competitive Play</h2>
    <p class="section-lead">Every online and local match runs on real-time Fischer clocks. Increment seconds are credited automatically after every legal pawn step or wall placement, eliminating lag-flagging in complex labyrinths.</p>
    <div class="table-wrap">
      <table class="editorial-table">
        <thead>
          <tr>
            <th>Preset</th>
            <th>Category</th>
            <th>Base Time</th>
            <th>Increment per Turn</th>
            <th>Typical Match Duration</th>
            <th>Tactical Profile</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>1+0</strong></td>
            <td>Bullet</td>
            <td>1 Minute</td>
            <td>+0 seconds</td>
            <td>90–120 seconds</td>
            <td>Pure intuition; pre-planned opening walls and rapid corridor reads.</td>
          </tr>
          <tr>
            <td><strong>1+1</strong></td>
            <td>Bullet Increment</td>
            <td>1 Minute</td>
            <td>+1 second</td>
            <td>2–3 minutes</td>
            <td>Fast pace with just enough increment to survive a 25-step endgame detour.</td>
          </tr>
          <tr>
            <td><strong>3+0</strong></td>
            <td>Blitz (Default)</td>
            <td>3 Minutes</td>
            <td>+0 seconds</td>
            <td>4–6 minutes</td>
            <td>The standard ladder format; balances deep mid-game calculation with clock pressure.</td>
          </tr>
          <tr>
            <td><strong>3+2</strong></td>
            <td>Blitz Increment</td>
            <td>3 Minutes</td>
            <td>+2 seconds</td>
            <td>5–8 minutes</td>
            <td>Ideal for high-wall tactical battles where both players contest center control.</td>
          </tr>
          <tr>
            <td><strong>5+0</strong></td>
            <td>Rapid</td>
            <td>5 Minutes</td>
            <td>+0 seconds</td>
            <td>7–10 minutes</td>
            <td>Club tournament standard; allows exact step-counting before committing key walls.</td>
          </tr>
          <tr>
            <td><strong>5+3</strong></td>
            <td>Rapid Increment</td>
            <td>5 Minutes</td>
            <td>+3 seconds</td>
            <td>9–13 minutes</td>
            <td>Rewards deep positional squeezing and multi-turn diagonal jump setups.</td>
          </tr>
          <tr>
            <td><strong>10+0</strong></td>
            <td>Classical Rapid</td>
            <td>10 Minutes</td>
            <td>+0 seconds</td>
            <td>12–20 minutes</td>
            <td>Full tree-calculation pace for serious study and championship sets.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="section" id="private-room-architecture">
  <div class="container grid-2">
    <div class="card-neutral">
      <p class="eyebrow">Instant Private Lobbies</p>
      <h3>How 6-Letter Room Codes &amp; Deep Links Work</h3>
      <p>Playing a friend online should never require mandatory account creation or friend-request friction. When you tap <strong>Create Room</strong>, the DuoOrb matchmaking gateway generates a unique 6-character code drawn from a 32-character unambiguous alphabet (<code>ABCDEFGHJKLMNPQRSTUVWXYZ23456789</code> — deliberately excluding <code>I</code>, <code>O</code>, <code>0</code>, and <code>1</code> so codes are never misread).</p>
      <p>Share the code directly or send the instant join URL (<code>https://duoorb.com/?room=CODE</code>) over WhatsApp, Discord, Telegram, or iMessage. Clicking the link bypasses the landing screen and drops your opponent directly into your lobby. The host can customize the mode (1v1, 4P Center Rush, or Race), wall budget (10, 15, or 99 walls), and clock preset before both players mark Ready.</p>
    </div>
    <div class="card-neutral">
      <p class="eyebrow">Rating Mathematics</p>
      <h3>Universal Glicko-2 Matchmaking Ladder</h3>
      <p>Every rated 1v1 match updates a unified competitive rating starting at <strong>1500</strong>. Unlike static Elo systems that treat every match equally, DuoOrb implements the <strong>Glicko-2 algorithm</strong>, which tracks three variables for every competitor:</p>
      <ul>
        <li><strong>Rating (R):</strong> Your visible skill estimate on the global leaderboard.</li>
        <li><strong>Rating Deviation (RD):</strong> Measures confidence in your rating. New players shift rapidly to reach their true tier; active veterans move with high precision.</li>
        <li><strong>Rating Volatility (σ):</strong> Detects sudden skill breakthroughs after studying engine reviews and adjusts your climb accordingly.</li>
      </ul>
    </div>
  </div>
</section>
Page 3: /rules.html — Complete Illustrated Rules, Jump Matrix & Notation
Target Word Count: ~1,600 words.
Job: Become the #1 definitive technical rulebook on the web. Fix every accuracy gap noted in §2.3 and §7 of your brief.

Exact Fixes & Additions for rules.html
Fix H1 & Meta: Remove the word "official" from <meta name="description"> and <h1>.

Fix Image Alt on Line 333: Change alt="... +0.9 evaluation bar..." to alt="DuoOrb post-match review screen showing move accuracy grading and shortest-path evaluation bar", and in H3 (:320), change "Positional Path Evaluation (+0.9)" to "Shortest-Path Differential & Move Grading".

Fix Bot Subset in FAQ (:366): Update the 4th FAQ answer from listing only 3 bots to listing all 7 calibrated personalities (Martin 800, Elena 1100, Nelson 1450, Sofia 1650, Marcus 1900, Viktor 2100, Achref 2400) plus the 3 generic difficulty tiers (Easy 1200, Normal 1500, Hard 1800), with a link to /bots-and-analysis.html.

Expand Rule Three (The Jumping Rule) with the 3-Trigger Diagonal Matrix: Explicitly state that a diagonal jump triggers when the square directly behind the adjacent opponent is blocked by (1) a placed wall, (2) the outer edge of the 9×9 board, OR (3) a third occupied orb in 3-player or 4-player modes. Emphasize that when a straight jump is open and legal, it is mandatory over diagonal leaps, and finished players in multi-orb modes become pass-through ghosts.

Add Two New Sections to rules.html (Multiplayer Rules Table + Algebraic Notation):

HTML
<section class="section section-fog" id="multiplayer-variants">
  <div class="container">
    <p class="eyebrow">2-Player, 3-Player &amp; 4-Player Specifications</p>
    <h2>Wall Budgets, Starting Coordinates &amp; Victory Targets</h2>
    <p class="section-lead">When more than two orbs share the 9×9 board, wall budgets scale down to keep the 128-slot groove lattice open and tactical, while victory conditions shift based on the selected format.</p>
    <div class="table-wrap">
      <table class="editorial-table">
        <thead>
          <tr>
            <th>Format ID</th>
            <th>Active Seats</th>
            <th>Walls per Seat</th>
            <th>Starting Coordinates (Row, Col)</th>
            <th>Goal Target</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Classic 1v1 (<code>2p</code>)</strong></td>
            <td>2 (Blue, Red)</td>
            <td>10 walls each</td>
            <td>Blue <code>(8,4)</code> · Red <code>(0,4)</code></td>
            <td>Blue → Row 0 · Red → Row 8</td>
          </tr>
          <tr>
            <td><strong>4P Center Rush (<code>4p</code>)</strong></td>
            <td>4 (Blue, Red, Green, Yellow)</td>
            <td>5 walls each</td>
            <td>B <code>(8,4)</code> · R <code>(0,4)</code> · G <code>(4,0)</code> · Y <code>(4,8)</code></td>
            <td>Exact center square <code>(4,4)</code></td>
          </tr>
          <tr>
            <td><strong>2P Center Duel (<code>center2</code>)</strong></td>
            <td>2 (Blue, Red)</td>
            <td>10 walls each</td>
            <td>Blue <code>(8,4)</code> · Red <code>(0,4)</code></td>
            <td>Exact center square <code>(4,4)</code></td>
          </tr>
          <tr>
            <td><strong>3P Center Rush (<code>center3</code>)</strong></td>
            <td>3 (Blue, Red, Green)</td>
            <td>6 walls each</td>
            <td>Blue <code>(8,4)</code> · Red <code>(0,4)</code> · Green <code>(4,0)</code></td>
            <td>Exact center square <code>(4,4)</code></td>
          </tr>
          <tr>
            <td><strong>Baseline Race (<code>race2–4</code>)</strong></td>
            <td>2, 3, or 4</td>
            <td>10 (2P), 6 (3P), 5 (4P)</td>
            <td>Row 8 cols: <code>[2,6]</code> (2P), <code>[1,4,7]</code> (3P), <code>[1,3,5,7]</code> (4P)</td>
            <td>All seats race to Row 0 (Top Edge)</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="section" id="notation">
  <div class="container">
    <p class="eyebrow">Match Recording &amp; Replay Standard</p>
    <h2>How to Read DuoOrb Algebraic Notation</h2>
    <p class="section-lead">Every match played in DuoOrb is recorded in a compact, human-readable coordinate notation used by the move stepper and analysis engine.</p>
    <div class="grid-3">
      <div class="card-neutral">
        <h3>1. Grid Coordinates</h3>
        <p>The 9×9 board uses columns <strong>a through i</strong> (left to right) and ranks <strong>1 through 9</strong>. Each seat is prefixed by its color code: <strong>B</strong> (Blue, Seat 1), <strong>R</strong> (Red, Seat 2), <strong>G</strong> (Green, Seat 3), and <strong>Y</strong> (Yellow, Seat 4).</p>
      </div>
      <div class="card-neutral">
        <h3>2. Pawn Steps (<code>Bd5</code>)</h3>
        <p>A pawn move combines the seat letter with the destination square. For example, <code>Bd5</code> means the Blue orb stepped (or jumped) onto column <strong>d</strong>, rank <strong>5</strong>. Similarly, <code>Re7</code> records the Red orb moving to square <strong>e7</strong>.</p>
      </div>
      <div class="card-neutral">
        <h3>3. Wall Drops (<code>Hd4</code> / <code>Ve6</code>)</h3>
        <p>Wall placements sit on the 8×8 internal intersection lattice (anchored by the top-left square of the 2×2 block the wall bisects). <code>Hd4</code> places a two-square <strong>Horizontal</strong> wall anchored at <strong>d4</strong>; <code>Ve6</code> places a <strong>Vertical</strong> wall anchored at <strong>e6</strong>.</p>
      </div>
    </div>
  </div>
</section>
Page 4 (NEW FILE): /strategy.html — Advanced Tactical Guide & Opening Theory
Create file: apps/mobile/public/strategy.html
Target Word Count: ~1,700 words.
Why this page is essential: When players lose a match or want to climb the ladder, they search "quoridor strategy", "how to win at quoridor", "quoridor opening moves", and "quoridor wall tactics". Right now, competitors own those keywords while DuoOrb only has a 90-word peach callout on rules.html. Creating strategy.html gives Google AdSense a massive, high-value educational article and captures the highest-intent organic players.

Complete Structure & Copy Blueprint for public/strategy.html
Use the exact same <head>, .site-nav, and .site-footer shell as rules.html, with these metadata and body sections:

Title: <title>DuoOrb &amp; Quoridor Strategy Guide — Openings, Wall Parity &amp; Endgame Tactics</title>

Meta Description: <meta name="description" content="Master high-level Quoridor and DuoOrb strategy: the Central March opening, the 3-Space Rule, Wall Parity calculation, side-corridor seals, and 4-player Center Rush tactics." />

Canonical: <link rel="canonical" href="[https://duoorb.com/strategy.html](https://duoorb.com/strategy.html)" />

JSON-LD: Article + FAQPage (with publisher: Organization AS Digital).

HTML
<main>
  <section class="section">
    <div class="container">
      <p class="eyebrow">Grandmaster Tactical Manual</p>
      <h1>DuoOrb &amp; Quoridor Strategy Guide: Openings, Wall Parity &amp; Endgame Calculation</h1>
      <p class="section-lead">The rules take sixty seconds to learn, but mastering the 128-slot wall lattice requires strict resource discipline. Every turn forces a zero-sum choice: spend tempo to advance your orb by one square, or spend a permanent wall from your finite 10-wall reserve to lengthen your opponent's shortest path.</p>
      <div class="hero-actions">
        <a href="/" class="btn-pill btn-pill-primary">Practice Strategy in Arena</a>
        <a href="/bots-and-analysis.html" class="btn-pill btn-pill-ghost">Spar Against 7 MCTS Bots</a>
      </div>
    </div>
  </section>

  <section class="section section-fog" id="core-heuristics">
    <div class="container">
      <p class="eyebrow">The Three Laws of Path Economics</p>
      <h2>How Master Players Value a Single Wall</h2>
      <p class="section-lead">Beginners place walls emotionally—dropping a horizontal fence right in front of the opponent's nose just to force a single sidestep. High-rated players evaluate every candidate wall using three mathematical invariants.</p>
      <div class="grid-3">
        <div class="card-neutral">
          <p class="eyebrow">Invariant 01</p>
          <h3>Net Path Differential (Δd ≥ +2)</h3>
          <p>Placing a wall costs you one full turn (1 tempo) and 10% of your wall budget without moving your own orb closer to the goal. Therefore, a wall that only forces your opponent to take 1 extra sidestep is a net loss—you spent a finite wall merely to break even in tempo. Never drop an offensive wall unless it increases your rival's shortest path by at least 2 steps relative to yours, or seals a multi-wall corridor trap.</p>
        </div>
        <div class="card-neutral">
          <p class="eyebrow">Invariant 02</p>
          <h3>The 3-Space Proximity Rule</h3>
          <p>Because every wall spans exactly two squares across a groove, any existing wall or board edge within two squares of your pawn's path is a latent tactical hook. When navigating through mid-board territory, maintain a three-square buffer from unsealed side corridors whenever possible, or preemptively drop a defensive wall that locks your own safe highway to the goal line.</p>
        </div>
        <div class="card-neutral">
          <p class="eyebrow">Invariant 03</p>
          <h3>Wall Parity &amp; Reserve Discipline</h3>
          <p>In a standard 1v1 duel, having 3 walls remaining when your opponent hits 0 walls is almost always a forced win. Once an opponent exhausts their 10 walls, they can only walk along a predictable shortest-path vector—allowing you to combine your final 2–3 walls into an uncontested 15-step detour across the width of the board.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="opening-theory">
    <div class="container">
      <p class="eyebrow">First 6 Plies</p>
      <h2>Standard Opening Systems on the 9×9 Grid</h2>
      <p class="section-lead">In almost all high-level games, both players spend the first three turns marching straight down the central e-file until their orbs stand face-to-face at the center of the board.</p>
      <div class="grid-2">
        <div class="card-neutral">
          <h3>1. The Classical Central March (3+3 Stem)</h3>
          <p>Blue starts at <code>(8,4)</code> and Red starts at <code>(0,4)</code>. Both players step straight toward the center row for three consecutive turns. Why not place walls on turn 1 or turn 2? Because an early wall placed while your opponent is still on row 1 or row 2 leaves them eight open ranks to route around it effortlessly, wasting your wall for zero net detour.</p>
          <p>Once the pawns stand one square apart in the center, tension peaks: whoever steps directly adjacent first hands the opponent a <strong>free straight jump</strong>, yielding a two-square leap in a single turn.</p>
        </div>
        <div class="card-neutral">
          <h3>2. The Defensive Back-Wall &amp; Gap System</h3>
          <p>Instead of stepping into a face-to-face jump disadvantage, master players often play a <strong>defensive horizontal wall behind their own orb</strong> (or one column offset, creating a two-square side gate). This accomplishes two strategic goals simultaneously: it passes the move initiative (forcing your opponent to step forward or spend a wall first) and it prevents your opponent from sealing your back ranks later in the mid-game.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-fog" id="midgame-tactics">
    <div class="container">
      <p class="eyebrow">Mid-Game &amp; Endgame Patterns</p>
      <h2>Four Tactical Motifs Every Competitor Must Recognize</h2>
      <div class="table-wrap">
        <table class="editorial-table">
          <thead>
            <tr>
              <th>Tactical Motif</th>
              <th>Board Geometry</th>
              <th>Execution &amp; Counterplay</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Self-Walling (Highway Locking)</strong></td>
              <td>Placing a vertical or horizontal wall adjacent to your own path that blocks a future enemy cut-off.</td>
              <td>Because walls cannot cross or overlap, placing a wall through a critical intersection makes it geometrically impossible for your opponent to place a perpendicular wall across that same groove.</td>
            </tr>
            <tr>
              <td><strong>The Two-Side Pinch</strong></td>
              <td>A horizontal wall skeleton spans columns b–g, leaving open passages on both the a-file (left) and i-file (right).</td>
              <td>Never close the side your opponent is walking toward first while the far side remains open—they will simply seal your path instead. Force them to commit to one wing, or close the distant wing when you hold a tempo lead.</td>
            </tr>
            <tr>
              <td><strong>Diagonal Jump Traps</strong></td>
              <td>Two orbs stand adjacent with a wall directly behind one orb, enabling a lateral diagonal leap.</td>
              <td>Before placing a frontal wall directly behind your own pawn in a duel, verify whether your opponent can step adjacent on the next ply and use your own wall as a springboard for a diagonal bypass.</td>
            </tr>
            <tr>
              <td><strong>4-Player Center Rush Funneling</strong></td>
              <td>Four players hold 5 walls each, all converging on tile <code>(4,4)</code>.</td>
              <td>In <code>4p</code> Center Rush, spending walls early against one player hands a free tempo lead to the other two seats. Conserve at least 3 of your 5 walls until an opponent enters the inner 3×3 ring around <code>(4,4)</code>.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section" id="strategy-faq">
    <div class="container">
      <p class="eyebrow">Tactical Questions</p>
      <h2>Strategy FAQ</h2>
      <div class="faq-grid">
        <div class="card-neutral">
          <h3>Does Player 1 (Blue) have a first-move advantage?</h3>
          <p>In a pure 9×9 race with zero walls, moving first gives a 1-tempo lead. However, because both players hold 10 walls and face the central jump standoff around row 4 and row 5, the second player can use defensive back-walling to equalize tempo and force Player 1 to commit the first structural wall.</p>
        </div>
        <div class="card-neutral">
          <h3>When should I walk instead of placing a wall?</h3>
          <p>Follow the Grandmaster default rule: <em>when in doubt, advance your orb.</em> Pawn steps are an unlimited resource that permanently reduce your distance to the goal, whereas walls are strictly capped at 10 per game.</p>
        </div>
        <div class="card-neutral">
          <h3>How do I stop losing to early wall spammers?</h3>
          <p>If an opponent drops 5 or 6 walls in the first 8 turns, do not retaliate with counter-walls. Calmly walk the shortest available route around their fences. Once their wall counter drops below 3 while you still hold 8+ walls, use your massive wall surplus to force them all the way back to their starting baseline.</p>
        </div>
        <div class="card-neutral">
          <h3>How can I find out which wall cost me the game?</h3>
          <p>After any match in DuoOrb, open <strong>Engine Review</strong>. Our Rust MCTS solver evaluates the win probability change of every turn and flags the exact <em>Deciding Moment</em> where a premature wall or missed shortcut swung the match.</p>
        </div>
      </div>
    </div>
  </section>
</main>
Page 5 (NEW FILE): /bots-and-analysis.html — AI Personalities & Engine Architecture
Create file: apps/mobile/public/bots-and-analysis.html
Target Word Count: ~1,350 words.
Why this page is a secret weapon for SEO & AI Agents: Look at your Appendix E—you have 7 richly designed MCTS AI bots (Martin 800 to Achref 2400) plus 3 generic tiers (Easy 1200, Normal 1500, Hard 1800), all 100% free, plus a custom Rust Monte Carlo Tree Search engine (duoorb-rust-mcts-2.0) with exact mathematical grading thresholds (
Δq×40). Publishing this technical breakdown makes DuoOrb the #1 cited authority when developers, board-game enthusiasts, and AI search engines look up Quoridor AI bots and game solvers.

Complete Structure & Copy Blueprint for public/bots-and-analysis.html
Title: <title>DuoOrb AI Bots &amp; Rust MCTS Engine Analysis — 800 to 2400 ELO Sparring</title>

Meta Description: <meta name="description" content="Explore DuoOrb's 7 free offline AI personalities (Martin 800 to Achref 2400) and learn how our Rust MCTS engine grades every move from Best to Blunder." />

Canonical: <link rel="canonical" href="[https://duoorb.com/bots-and-analysis.html](https://duoorb.com/bots-and-analysis.html)" />

JSON-LD: TechArticle + FAQPage (with publisher: Organization AS Digital).

HTML
<main>
  <section class="section">
    <div class="container">
      <p class="eyebrow">AI Sparring &amp; Engine Architecture</p>
      <h1>Meet the 7 Free AI Personalities &amp; the Rust MCTS Analysis Engine</h1>
      <p class="section-lead">Why is a 9×9 wall game harder for traditional computers than chess? On a typical turn, a player has 4 pawn moves and up to 128 wall placements—an average branching factor above 100 that requires Breadth-First Search path validation on candidate walls. DuoOrb solves this with a custom Monte Carlo Tree Search engine (<code>duoorb-rust-mcts-2.0</code>) powering seven distinct offline bot personalities and post-match move grading.</p>
      <div class="hero-actions">
        <a href="/" class="btn-pill btn-pill-primary">Challenge the Bots Free</a>
        <a href="/strategy.html" class="btn-pill btn-pill-ghost">Study Tactical Strategy</a>
      </div>
    </div>
  </section>

  <section class="section section-fog" id="bot-roster">
    <div class="container">
      <p class="eyebrow">100% Free · Works Offline</p>
      <h2>The Complete 7-Bot Personality Ladder (800 to 2400 Rating)</h2>
      <p class="section-lead">Every bot in DuoOrb is unlocked for free with zero paywalls. In addition to three standard calibration tiers—<strong>Easy (1200)</strong>, <strong>Normal (1500)</strong>, and <strong>Hard (1800)</strong>—you can spar against seven named personalities with distinct MCTS simulation budgets, exploration randomness, and wall-placement tendencies.</p>
      <div class="table-wrap">
        <table class="editorial-table">
          <thead>
            <tr>
              <th>Bot Personality</th>
              <th>Rating &amp; Tier</th>
              <th>MCTS Playouts</th>
              <th>Think Budget</th>
              <th>Randomness</th>
              <th>Signature Playing Style &amp; Bio</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Martin</strong><br><em>The Friendly Dad</em></td>
              <td><strong>800</strong><br>Beginner</td>
              <td>250 sims</td>
              <td>40 ms</td>
              <td>0.50 (High)</td>
              <td>Low wall frequency (0.15). Plays for fun, advances his orb straightforwardly, and leaves clear tactical openings for newcomers learning jump rules.</td>
            </tr>
            <tr>
              <td><strong>Elena</strong><br><em>The Eager Student</em></td>
              <td><strong>1100</strong><br>Beginner</td>
              <td>600 sims</td>
              <td>60 ms</td>
              <td>0.15 (Moderate)</td>
              <td>Moderate wall frequency (0.35). A university board-game theorist who tests early opening fences and punishes basic one-move overlooks.</td>
            </tr>
            <tr>
              <td><strong>Nelson</strong><br><em>The Aggressive Challenger</em></td>
              <td><strong>1450</strong><br>Intermediate</td>
              <td>1,000 sims</td>
              <td>100 ms</td>
              <td>0.10 (Low)</td>
              <td>Direct, relentless pressure. Loves dropping aggressive frontal walls to disrupt your rhythm and force early corridor detours.</td>
            </tr>
            <tr>
              <td><strong>Sofia</strong><br><em>The Calm Competitor</em></td>
              <td><strong>1650</strong><br>Intermediate</td>
              <td>1,500 sims</td>
              <td>150 ms</td>
              <td>0.05 (Minimal)</td>
              <td>Experienced club player who favors surgical, high-efficiency walls and clean tempo calculation over reckless wall races.</td>
            </tr>
            <tr>
              <td><strong>Marcus</strong><br><em>The Seasoned Master</em></td>
              <td><strong>1900</strong><br>Master</td>
              <td>2,200 sims</td>
              <td>200 ms</td>
              <td>0.00 (Zero)</td>
              <td>Pure deterministic search. Builds suffocating multi-wall corridors and exploits wall-parity imbalances in the second half of the match.</td>
            </tr>
            <tr>
              <td><strong>Viktor</strong><br><em>The Master Analyst</em></td>
              <td><strong>2100</strong><br>Master</td>
              <td>3,000 sims</td>
              <td>240 ms</td>
              <td>0.00 (Zero)</td>
              <td>Grandmaster theorist with deep branching calculation. Counts exact endgame step differentials and locks down side-file escape routes.</td>
            </tr>
            <tr>
              <td><strong>Achref</strong><br><em>The System Architect</em></td>
              <td><strong>2400</strong><br>Master</td>
              <td>3,500 sims</td>
              <td>1,000 ms</td>
              <td>0.00 (Zero)</td>
              <td>The pinnacle DuoOrb architect persona. Runs full-second deep MCTS rollouts to uncover hidden counter-traps and mathematically optimal wall geometry.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section" id="engine-grading">
    <div class="container grid-2">
      <div>
        <p class="eyebrow">Post-Match Breakdown</p>
        <h2>How <code>duoorb-rust-mcts-2.0</code> Grades Every Turn</h2>
        <p>After completing a match, DuoOrb's analysis engine steps through the game notation and computes the expected win-value shift (<code>Δq</code>) for every pawn step and wall placement. By scaling the evaluation loss (<code>Loss = Δq × 40</code>) alongside shortest-path retention, every move is assigned one of seven transparent classifications:</p>
        <ul>
          <li><strong>Best (Loss ≤ 0.03):</strong> The mathematically optimal path step or highest-leverage wall on the board.</li>
          <li><strong>Excellent (Loss ≤ 0.07):</strong> A near-optimal decision that preserves full positional command.</li>
          <li><strong>Good (Loss ≤ 0.15):</strong> A solid, practical move (guaranteed whenever move accuracy retains ≥ 85% win equity).</li>
          <li><strong>Forced:</strong> The only sensible legal response in a single-corridor sequence.</li>
          <li><strong>Inaccuracy (Loss ≤ 0.28):</strong> A suboptimal wall or passive step that yields 1–2 steps of tempo.</li>
          <li><strong>Mistake (Loss ≤ 0.42):</strong> A serious tactical slip that hands control of the board state to your opponent.</li>
          <li><strong>Blunder (Loss greater than 0.42):</strong> A game-swinging error—such as sealing the wrong wing of the board or walking into a multi-wall trap.</li>
        </ul>
      </div>
      <div class="product-artifact">
        <img src="/screenshots/match-review-analysis.png" width="300" height="650" loading="lazy" alt="DuoOrb post-match move stepper showing MCTS win evaluation bar and move classifications" />
        <div class="artifact-caption">
          <strong>Interactive Move Stepper &amp; Deciding Moment</strong> — Scrub through every ply of your match, inspect the live evaluation bar, and compare your move against the engine's recommended line.
        </div>
      </div>
    </div>
  </section>
</main>
Page 6: /what-is-the-game-with-two-balls-and-walls.html — The Viral Identifier Guide
Target Word Count: ~950 words.
Job: Convert users searching descriptive queries ("what is the game with two balls and walls", "board game with fences and two marbles", "wooden labyrinth duel game") into instant browser players.

Fixes & Upgrades for what-is-the-game-with-two-balls-and-walls.html
Remove Unverified Hype & Platform Trademarks (:114): Replace "Millions of people watched two players lock each other into high-stakes mazes on TikTok, Instagram Reels, and YouTube Shorts" with factual, evergreen copy:
"Across short-form video feeds and tabletop streams, one clip format always stops the scroll: two spheres facing off on a 9×9 grid while players rapidly drop wooden fences into the grooves between squares to build last-second mazes."

Shorten <title>: <title>What Is the Game with Two Balls and Walls? | Play Free on DuoOrb</title> (64 chars).

De-duplicate the 6 Feature Cards (:199-246): Right now, Section 4 of this page copies the exact 6 feature cards from index.html (and even mentions a non-existent "Campaign Mode / Solo Journey & Quests" on line 231, which is not in your engine truth!). Delete that inaccurate "Solo Journey & Quests" card immediately, and replace Section 4 with a Visual & Terminology Identification Table that directly answers what searchers are looking for:

HTML
<section class="section section-fog" id="identification-checklist">
  <div class="container">
    <p class="eyebrow">60-Second Identification Guide</p>
    <h2>How to Confirm You Found the Exact Game from the Video</h2>
    <p class="section-lead">People search for this abstract strategy classic under dozens of descriptive names—from "the two marbles and wooden fences game" to "the 9×9 corridor block game." Check these five signature mechanics against the clip you watched:</p>
    <div class="table-wrap">
      <table class="editorial-table">
        <thead>
          <tr>
            <th>What You Saw in the Clip</th>
            <th>Actual Game Term in DuoOrb</th>
            <th>How the Mechanic Works</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Two spheres or pawns starting at opposite ends of a square grid</td>
            <td><strong>Orbs on the 9×9 Arena</strong></td>
            <td>Blue starts on bottom center <code>(8,4)</code> and races to the top edge; Red starts on top center <code>(0,4)</code> and races to the bottom edge.</td>
          </tr>
          <tr>
            <td>Players sliding flat wooden planks into slots between squares</td>
            <td><strong>2-Square Groove Walls</strong></td>
            <td>Each player starts a 1v1 duel with 10 walls. Placing a wall takes your entire turn and permanently blocks two adjacent square edges.</td>
          </tr>
          <tr>
            <td>One ball hopping straight or diagonally over the other ball</td>
            <td><strong>Straight &amp; Diagonal Jumps</strong></td>
            <td>When two orbs stand face-to-face without a wall between them, the active player leaps straight over—or diagonally if a wall blocks behind.</td>
          </tr>
          <tr>
            <td>A player forced to walk all the way back across a giant zig-zag maze</td>
            <td><strong>The Golden Path Rule</strong></td>
            <td>You can never seal an opponent in completely (at least 1 open path must always exist), but you can force a 25-step detour across the board.</td>
          </tr>
          <tr>
            <td>Four different colored pieces racing toward the middle of the board</td>
            <td><strong>4-Player Center Rush</strong></td>
            <td>DuoOrb's party mode where 4 players start on all four edges with 5 walls each and race to claim the single center square <code>(4,4)</code>.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
Page 7: /app.html — The Mobile & PWA Guide
Target Word Count: ~950 words.
Job: Own mobile, offline, pass-and-play, and PWA installation queries while staying 100% honest about "Coming Soon" native store status.

Exact Fixes on app.html
Fix Eyebrow (:87): Change "Official Mobile App" to "Mobile App &amp; Installable PWA".

Fix Bot Count (:181 and :251): Change "Martin (800 ELO beginner), Elena (1100 intermediate), Nelson (1450 club level), or the uncompromising Engine AI" to list all 7 bots (Martin 800, Elena 1100, Nelson 1450, Sofia 1650, Marcus 1900, Viktor 2100, and Achref 2400) plus Easy / Normal / Hard tiers, all 100% free offline.

Fix Room Code Error (:187): Change "generate a 4-digit room code" to "generate a 6-letter room code".

Fix Clocks & Walls Error (:193): Change "Adjust wall budgets between 10 walls, 15 walls, or unlimited sandbox mode. Set timers to 1+0 bullet, 3+0 blitz, or unlimited." to:
"Select Classic 1v1, Baseline Race, or 4-Player Center Rush. Set custom room wall budgets to 10, 15, or 99 walls (sandbox mode), and choose from 7 Fischer time controls ranging from 1+0 Bullet and 3+0 Blitz to 10+0 Rapid."

Fix Uncited +0.9 & Missing Image Dimensions (:211-215): Add width="300" height="650" to <img src="/screenshots/match-review-analysis.png" ...> on line 215, and replace "+0.9 advantage curve" with "MCTS win-probability evaluation curve".

Add a Step-by-Step PWA Installation Section (Adds +300 Words of High-Utility Content): Because the Google Play and Apple App Store native packages are currently Coming Soon, give mobile visitors a clear, step-by-step guide to installing the full-screen Progressive Web App today:

HTML
<section class="section section-fog" id="ios-coming-soon">
  <div class="container">
    <p class="eyebrow">Zero-Wait Mobile Access</p>
    <h2>How to Install DuoOrb on iOS &amp; Android Today (PWA)</h2>
    <p class="section-lead">While our native Google Play and Apple App Store packages complete pre-release preparation, you can install DuoOrb directly to your phone's home screen in ten seconds. It launches full-screen in portrait mode without browser toolbars.</p>
    <div class="grid-3">
      <div class="card-neutral">
        <h3>1. iPhone &amp; iPad (Safari)</h3>
        <p>Open <strong>duoorb.com</strong> in Safari, tap the <strong>Share</strong> icon at the bottom of the screen, scroll down and select <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>. DuoOrb will appear on your home screen with its custom icon and standalone full-screen viewport.</p>
      </div>
      <div class="card-neutral">
        <h3>2. Android (Chrome / Edge)</h3>
        <p>Open <strong>duoorb.com</strong> in Chrome, tap the three-dot menu in the top corner, and select <strong>Install app</strong> (or <strong>Add to Home screen</strong>). The web app caches core board assets locally for rapid launch and smooth 60 FPS touch controls.</p>
      </div>
      <div class="card-neutral">
        <h3>3. Cross-Platform Account Sync</h3>
        <p>Play immediately as an anonymous guest, or sign in with Google (powered by Supabase Auth) to lock in your universal Glicko-2 rating, match history, and friend list. When the native iOS and Android store apps launch, your progress carries over automatically.</p>
      </div>
    </div>
  </div>
</section>
Page 8: /about.html — Studio Identity, Engineering & E-E-A-T Trust Hub
Target Word Count: ~750 words (up from ~195 words).
Job: Satisfy Google AdSense and Search Quality Rater E-E-A-T requirements (Who built this site? How is it engineered? Is it trustworthy?).

Fixes & Additions for about.html
Remove AdSense Script from <head> of about.html.

Fix Line 60 Contradiction: Change "Available now on Google Play. Coming soon to the App Store." to "Coming soon to Google Play and the Apple App Store. Play the web app and installable PWA today."

Add Three Deep E-E-A-T Sections: Expand about.html by adding studio architecture, accessibility & localization, and fair-play engineering sections:

HTML
<section class="section section-fog" id="engineering-philosophy">
  <div class="container">
    <p class="eyebrow">Engineering &amp; Architecture</p>
    <h2>Built for Deterministic Speed, Accessibility &amp; Fair Play</h2>
    <p class="section-lead">DuoOrb is designed, engineered, and operated by <strong>AS Digital</strong> with a singular focus: bringing modern competitive infrastructure—Glicko-2 matchmaking, instant link lobbies, and MCTS post-game analysis—to tactical grid strategy.</p>
    <div class="grid-3">
      <div class="card-neutral">
        <h3>Authoritative Server Ruleset</h3>
        <p>Every online move, jump vector, Fischer clock increment, and Breadth-First Search (BFS) Golden Rule path check is validated on an authoritative backend server. Client tampering, illegal wall overlaps, or zero-path dead ends are rejected at the protocol layer.</p>
      </div>
      <div class="card-neutral">
        <h3>10-Language Global Accessibility</h3>
        <p>Strategy belongs to everyone. DuoOrb is localized across ten languages—including English, Arabic (with full RTL layout support and custom Tajarib typography), French, German, Spanish, Turkish, and Portuguese—with high-contrast orb palettes and legal-move highlights.</p>
      </div>
      <div class="card-neutral">
        <h3>Respectful Monetization</h3>
        <p>We believe players should never be interrupted mid-calculation. All seven AI personalities and all online game modes are free to play. On the web, non-intrusive page ads help fund server infrastructure, and live board matches are never interrupted by video popups.</p>
      </div>
    </div>
  </div>
</section>
Pages 9–12: Legal & Support Pages (privacy.html, terms.html, cookies.html, contact.html)
Remember: Remove the AdSense <script> tag from the <head> of all four of these pages, and add BreadcrumbList JSON-LD to each.

1. cookies.html — Expand from 68 words to ~450 words (Add Explicit Cookie Table)
Insert this table inside cookies.html so AdSense reviewers see full IAB TCF v2.3 / Google AdSense transparency:

HTML
<section class="section">
  <div class="container">
    <h2>Cookies &amp; Local Storage Used on DuoOrb.com</h2>
    <p>We use first-party session storage to operate the game interface and Google AdSense cookies (subject to your consent in the EEA, UK, and Switzerland) to serve, cap, and measure advertisements on our informational web pages.</p>
    <div class="table-wrap">
      <table class="editorial-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Provider</th>
            <th>Type</th>
            <th>Duration</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>duoorb-played</code></td>
            <td>duoorb.com (First-Party)</td>
            <td><code>sessionStorage</code></td>
            <td>Browser Session</td>
            <td>Strictly necessary UI state: remembers that you dismissed the editorial welcome overlay during the current tab session.</td>
          </tr>
          <tr>
            <td><code>sb-*-auth-token</code></td>
            <td>Supabase Auth (First-Party)</td>
            <td><code>localStorage</code></td>
            <td>Persistent until logout (180d guest cap)</td>
            <td>Strictly necessary authentication token that preserves your guest session or signed-in Google account across matches.</td>
          </tr>
          <tr>
            <td><code>__gads</code></td>
            <td>Google AdSense</td>
            <td>HTTP Cookie</td>
            <td>13 Months</td>
            <td>Advertising measurement: enables websites to show Google ads, measures ad interactions, and prevents the same ad from displaying too many times.</td>
          </tr>
          <tr>
            <td><code>__gpi</code></td>
            <td>Google AdSense</td>
            <td>HTTP Cookie</td>
            <td>13 Months</td>
            <td>Google Publisher Identifier: collects information on visitor behavior across ad-supported pages to optimize ad delivery and frequency capping.</td>
          </tr>
          <tr>
            <td><code>FCNEC</code> / <code>FCCDCF</code></td>
            <td>Google Funding Choices CMP</td>
            <td>HTTP Cookie</td>
            <td>12 Months</td>
            <td>Consent Management: stores your IAB TCF v2.3 and Google Consent Mode v2 privacy choices so you are not prompted on every page load.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
2. contact.html — Expand from 80 words to ~400 words
Add structured support categories, expected response times, and exact email templates so users and reviewers see a real operating studio:

Official Support Channel: support@duoorb.com (Operated by AS Digital).

Response Time SLA: Standard inquiries and bug reports answered within 2–3 business days; verified GDPR/CCPA data export and account deletion requests completed within 30 calendar days (and typically under 7 days).

3 Cards in .grid-3:

Account Deletion & Data Export (Subject line: "Delete my DuoOrb account", include Handle + User ID or email from your linked Google address; note that in-app instant deletion is also available at Settings -> Delete Account).

Fair Play & Abuse Reports (Subject line: "Fair Play Report", include opponent Handle, Room Code or Match Timestamp, and description of suspected win-trading, collusion, or profile abuse).

Technical Bug Reports & Feedback (Subject line: "Bug Report", include Device/Browser, Game Mode, and Algebraic Notation or screenshot if a wall/jump rendered unexpectedly).

3. Sync Server Legal (apps/server/src/legal/legal-content.ts) with Web Legal
In §8 of your brief, you noted that apps/server/src/legal/legal-content.ts §6 still says DuoOrb Premium unlocks "exclusive bots / Midnight theme", whereas your engine truth (MatchSetupScreen.tsx:289) makes all 7 bots + 3 generic tiers 100% free.

Action: Update legal-content.ts §6 (and keep public/terms.html §5 aligned) so both state:
"All game modes and all 7 offline AI bot personalities are free for all players. DuoOrb Premium ($3.99/month or $24.99/year, with a 7-day free trial) removes advertisements in the mobile app and unlocks unlimited daily Engine Match Reviews (free tier includes 1 full engine review per day plus extra reviews via optional rewarded ads)."

Part 4: Technical, Asset & Core Web Vitals Cleanup
Execute these 5 quick commands in apps/mobile/public/ to eliminate dead weight and layout shifts:

Delete Orphaned Fonts & Unused Images (~407 KB saved):

Verify that native (apps/mobile/src/) does not reference public/fonts/Satoshi-* or Manrope-ExtraLight / Manrope-Light. Delete the 4 unreferenced Satoshi font files (~197 KB), the 2 unreferenced Manrope 200/300 files (~193 KB), and the orphaned /icons/splash-icon.png (~17.5 KB, replaced by splash-400.webp).

Keep /screenshots/match-setup.png (now wired into index.html) and /screenshots/modal-dialog.png (now wired into quoridor-online.html). Zero orphaned files remain!

Compress og-image.png (590 KB → under 180 KB):

Social crawlers (WhatsApp, Discord, X/Twitter) often time out or drop previews on PNGs over 300 KB. Run pngquant --quality=70-85 apps/mobile/public/og-image.png --ext .png --force (keeping exact 1200×630 dimensions and the /og-image.png filename).

Align manifest.json Colors (public/manifest.json):

Change "theme_color": "#0F172A" to "theme_color": "#FFFFFF" and "background_color": "#0B0E14" to "#FAFAFB" so installing the PWA doesn't flash a dark slate frame against your light #FFFFFF/#FAFAFB design system.

Inject publisher Organization Schema on Every Page:

Every JSON-LD block (index.html, quoridor-online.html, rules.html, strategy.html, bots-and-analysis.html, what-is-the-game-with-two-balls-and-walls.html, app.html) should include:

JSON
"author": {
  "@type": "Organization",
  "name": "AS Digital",
  "url": "https://duoorb.com/about.html",
  "email": "support@duoorb.com"
},
"publisher": {
  "@type": "Organization",
  "name": "AS Digital",
  "url": "https://duoorb.com/",
  "logo": {
    "@type": "ImageObject",
    "url": "https://duoorb.com/icons/icon-512.png",
    "width": 512,
    "height": 512
  }
}
Rebuild dist/ Before Deploying:

Remember that apps/mobile/dist/ is stale. After editing apps/mobile/public/, run cd apps/mobile && npx expo export --platform web and verify that all 12 .html files, /ads.txt, /llms.txt, and /sitemap.xml are copied cleanly to dist/.

Part 5: AI Agent SEO & GEO (Generative Engine Optimization) Drop-In Files
When a user asks ChatGPT, Perplexity, Claude, or Google AI Overviews: "What is the best place to play Quoridor online free with friends or against strong AI bots?", AI agents parse robots.txt, llms.txt, and structured JSON catalogs. Replace your stale crawler files with these complete, engine-verified versions:

1. public/robots.txt (Explicitly Welcoming Search + AI Grounding Bots)
Plaintext
User-agent: *
Allow: /
Disallow: /play.html

User-agent: Googlebot
Allow: /

User-agent: Mediapartners-Google
Allow: /

User-agent: AdsBot-Google
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://duoorb.com/sitemap.xml
2. public/llms.txt (Updated to Engine Truth — 7 Bots, 7 Clocks, 12 Pages)
Markdown
# DuoOrb (https://duoorb.com)

> DuoOrb by AS Digital is a free-to-play competitive 9×9 tactical grid board game (inspired by classic abstract corridor strategy rules) playable instantly in any modern web browser with zero registration required. Players alternate moving their orb one orthogonal square or placing a permanent two-square wall into the 8×8 groove lattice (128 wall slots) to lengthen their opponent's shortest path while obeying the Golden Path Rule (every active player must always retain at least one valid path to their goal).

## Core Capabilities & Engine Truth
- **Instant Browser Arena (`https://duoorb.com/`):** Play immediately as a guest with zero downloads or signups.
- **Private Friend Lobbies:** One-tap creation of a 6-letter unambiguous room code (`https://duoorb.com/?room=CODE`) supporting custom wall budgets (10, 15, or 99 walls).
- **Rated 1v1 Matchmaking:** Universal Glicko-2 competitive rating starting at 1500 with global leaderboards.
- **7 Fischer Clock Presets:** `1+0` Bullet, `1+1` Bullet, `3+0` Blitz (Default), `3+2` Blitz, `5+0` Rapid, `5+3` Rapid, and `10+0` Classical Rapid.
- **4 Competitive Game Modes:** Classic 1v1 (10 walls each, opposite baseline goal), 4-Player Center Rush (5 walls each, race to center tile `(4,4)`), 2P/3P Center Duel (10 or 6 walls each, goal `(4,4)`), and 2P–4P Baseline Race.
- **7 Free Offline MCTS AI Personalities + 3 Calibration Tiers:** Powered by `duoorb-rust-mcts-2.0`. Personalities: Martin (800), Elena (1100), Nelson (1450), Sofia (1650), Marcus (1900), Viktor (2100), and Achref (2400), plus Easy (1200), Normal (1500), and Hard (1800). All bots are 100% free.
- **Post-Match Engine Review:** Grades every move (`Best`, `Excellent`, `Good`, `Forced`, `Inaccuracy`, `Mistake`, `Blunder`) using expected win-equity loss (`Δq × 40`), shortest-path evaluation bars, and interactive move steppers.
- **Platforms & Localization:** Live on Web and installable as an offline-capable PWA today; native Android (Google Play) and iOS (App Store) apps are Coming Soon. Localized in 10 languages (EN, AR, FR, DE, ES, TR, PT, and more).

## Canonical Documentation & Pages
- [Web Arena & Overview](https://duoorb.com/): Instant browser gameplay and mode specifications.
- [Play Quoridor Online Guide](https://duoorb.com/quoridor-online.html): Private 6-letter rooms, 7 Fischer clocks, and Glicko-2 ladder details.
- [Complete Illustrated Rules](https://duoorb.com/rules.html): 9×9 setup, straight vs. 3-trigger diagonal jump rules, Golden Path BFS validation, and algebraic notation (`Bd5`, `Hd4`).
- [Tactical Strategy & Openings](https://duoorb.com/strategy.html): Central March opening, the 3-Space Rule, Wall Parity, and endgame corridor tactics.
- [AI Bots & MCTS Analysis Engine](https://duoorb.com/bots-and-analysis.html): Dossiers on all 7 free MCTS bots (800–2400) and `duoorb-rust-mcts-2.0` move grading math.
- [Viral "Two Balls and Walls" Identifier](https://duoorb.com/what-is-the-game-with-two-balls-and-walls.html): Visual identification guide for players who saw the wooden fence maze game on social video feeds.
- [Mobile App & PWA Guide](https://duoorb.com/app.html): iOS/Android PWA installation steps, offline bot sparring, and upcoming store status.
- [About AS Digital](https://duoorb.com/about.html): Studio identity, fair-play server architecture, and contact (`support@duoorb.com`).
- [Legal & Privacy](https://duoorb.com/privacy.html): Privacy Policy, [Terms of Service](https://duoorb.com/terms.html), [Cookies & AdSense Disclosure](https://duoorb.com/cookies.html), and [Contact](https://duoorb.com/contact.html).
3. public/ai-catalog.json (Expanded to Full Site Entity Graph)
JSON
{
  "schema_version": "1.1",
  "name": "DuoOrb",
  "version": "2.0.0",
  "publisher": {
    "name": "AS Digital",
    "email": "support@duoorb.com",
    "url": "https://duoorb.com/about.html"
  },
  "description": "Free online 9x9 tactical grid board game featuring rated 1v1 Glicko-2 duels, 6-letter private friend rooms, 4-player Center Rush, 7 free MCTS AI bots (800-2400 rating), and Rust MCTS post-match move analysis.",
  "resources": [
    { "name": "DuoOrb Web Arena", "url": "https://duoorb.com/", "type": "application" },
    { "name": "Online Multiplayer & Clocks Guide", "url": "https://duoorb.com/quoridor-online.html", "type": "documentation" },
    { "name": "Complete Rules, Jumps & Notation", "url": "https://duoorb.com/rules.html", "type": "documentation" },
    { "name": "Strategy, Openings & Wall Parity Guide", "url": "https://duoorb.com/strategy.html", "type": "documentation" },
    { "name": "AI Bots (800-2400) & Rust MCTS Analysis", "url": "https://duoorb.com/bots-and-analysis.html", "type": "documentation" },
    { "name": "Game Identifier Guide (Two Balls & Walls)", "url": "https://duoorb.com/what-is-the-game-with-two-balls-and-walls.html", "type": "documentation" },
    { "name": "Mobile App & PWA Installation", "url": "https://duoorb.com/app.html", "type": "documentation" },
    { "name": "About DuoOrb & AS Digital", "url": "https://duoorb.com/about.html", "type": "about" },
    { "name": "Privacy Policy", "url": "https://duoorb.com/privacy.html", "type": "policy" },
    { "name": "Terms of Service", "url": "https://duoorb.com/terms.html", "type": "policy" },
    { "name": "Cookies & AdSense Policy", "url": "https://duoorb.com/cookies.html", "type": "policy" },
    { "name": "Contact & Support", "url": "https://duoorb.com/contact.html", "type": "support" }
  ]
}
4. public/sitemap.xml (12 Canonical URLs + Image Extensions, /play.html Removed)
Update public/sitemap.xml to remove /play.html, add /strategy.html (priority 0.90) and /bots-and-analysis.html (priority 0.88), and include <xmlns:image="[http://www.google.com/schemas/sitemap-image/1.1](http://www.google.com/schemas/sitemap-image/1.1)"> tags for your 7 screenshots (gameplay-duel.png, match-review-analysis.png, four-player-rush.png, app-modes.png, clutch-board-endgame.png, match-setup.png, modal-dialog.png) so Google Images indexes your board visuals directly for "quoridor online" and "game with two balls and walls" image searches.

Interactive Audit & Traffic-to-AdSense Simulator
Use the interactive blueprint below to inspect the before-and-after metrics across all 12 URLs, verify your AdSense P0/P1 compliance checklist, and model how expanding your keyword footprint with strategy.html and bots-and-analysis.html impacts organic sessions and estimated AdSense revenue:


Was this visual helpful?