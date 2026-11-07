# Morris AI Family — UX review and redesign brief

Reviewed November 7, 2026. Primary domain confirmed by the owner: **morrisai.family**.

## Scope and evidence

This is a source-based UX review of core flows, with public-page inspection and read-only Vercel configuration checks. The reviewed `morris-hub` commit is `2137cf19620773806c13e14bb6f492bcd5f4d5db`, matching the latest READY production deployment returned by Vercel during the review. The separate PCAFI workspace is unrelated and was not changed.

Inspected areas: Today, Panel, Ask Morris, Student Support, Buddy, Health, Finance and retirement, Investments, Career, Bible, Travel, News, Family, onboarding, settings, shared navigation, login, and routing. Source references below are relative to this repository at the reviewed commit. The subsequent voice implementation is described separately at the end.

Authenticated browser journeys, actual audio quality on physical devices, production integration reliability, screen-reader behavior, and measured performance were not tested during the initial review. A source finding is not a claim that a production interaction was reproduced. Proposed design targets are acceptance criteria, not measured results.

## Product direction

The product has substantial capability, but its organization asks users to remember internal routes and settings. The redesign should give each app a clear purpose, a memorable address, an obvious next action, and a shared way to move between apps.

The owner supplied these priorities:

- **Panel:** a focused conversation workspace inspired by the qualities they like in Codex and Claude, with history, a stable composer, and room to work with outputs.
- **Student Support and Buddy:** easy, fun, age-appropriate experiences. Parent administration and the child's learning activity should have distinct entrances.
- **Health:** frictionless everyday use, with robust detail available on demand.
- **News:** comprehensive coverage, easy access, and breadth across topics and sources.
- **Bible:** simple, robust, high quality, and grounded. Reading and listening come first; study assistance supports the text.
- **Voice:** extend the newer Buddy voice to the platform, especially Bible narration.

The existing code already contains recent improvements: theme tokens, cloud voices for Buddy, Panel streaming and cost estimates, child-week organization, and workout resume. Preserve these. The perception of age is more plausibly explained by narrow desktop layouts, repeated list screens, small labels, hidden destinations, and inconsistent product naming than by the age of the stack.

## Highest-priority findings

Priority definitions: **P0** blocks the requested destination model or loses user intent; **P1** substantially affects core usability or confidence; **P2** improves efficiency and polish.

| ID | Priority | Observed evidence | User impact | Required change |
| --- | --- | --- | --- | --- |
| UX-01 | P0 | Vercel project domains returned only `morrisai.family`, `www.morrisai.family`, and `morris-hub-ebon.vercel.app`. | The requested feature addresses are not attached to this project. This does not establish their global DNS state. | Attach and verify the approved feature hosts, configure their routing, and validate HTTPS. |
| UX-02 | P0 | `next.config.ts` redirects Health, Finance, and Bible subdomain requests to apex paths. Panel has no corresponding host mapping. | Feature hosts, if attached, would move users away from the requested app address. | Serve each app at its own host through host-aware routing. Replace conflicting redirects. |
| UX-03 | P0 | `proxy.ts` redirects unauthenticated protected routes to `/`; login sends existing sessions to `/home`; OAuth initiation supplies no originating destination. Callback accepts a relative `next`, but this flow does not carry it through. | A link to a chapter, conversation, or record loses its destination during login. | Preserve an allowlisted app, path, and query through sign-in and account approval. |
| UX-04 | P1 | The active iOS `TabBar` offers Today, Family/Me, Health, and More. Panel and News also have Today shortcuts. Many app pages select More as their current location. | Important tools lack persistent app identity; shortcuts depend on returning to Today. | Give every core app a labeled launcher entry and its own local navigation. Keep News and Panel one action away. |
| UX-05 | P1 | `app/ios.css` caps the main scroll area at 640px. Panel implements a separate wider column. | Dense desktop workflows mostly retain a phone-width layout. | Use adaptive app workspaces: sidebar plus content on desktop, focused content and compact navigation on mobile. Preserve narrower text columns for reading. |
| UX-06 | P1 | `/children` is titled Student Success; More labels `/home/me/courses` Student success; LSAT lives under `/career/lsat`. | The advertised academic app has multiple meanings and entry points. | Establish one Student Support home, with role-specific views and explicit Courses, Practice, and Children destinations. |
| UX-07 | P1 | News uses `prefs.visible_widgets` to decide its entire feed. | Removing a news widget from Today can also empty the dedicated News app. | Separate News subscriptions and topic preferences from home-widget visibility. |
| UX-08 | P1 | `lib/news.ts` has three general topic queries: politics, AI, and Claude. Local, company, RSS, and sports are additional separate paths. | The general feed has a narrow editorial scope relative to the owner's breadth requirement. | Add broad default sections and a dedicated news discovery model. |
| UX-09 | P1 | `NewsClient` shows one article per topic through 28px previous/next buttons. Subscription rendering uses `filtered.slice(0, 8)` without an expansion control in that component. | Coverage is hard to scan and additional stories are hidden or unavailable in the visible list. | Render a readable feed with pagination or Load more, topic filters, and source context. |
| UX-10 | P1 | Panel thread synchronization is best-effort and ignores failed responses; local storage remains the browser's source of truth. | Users cannot tell whether a conversation will appear on another device or host. | Show Saved, Saving, and Saved on this device states, with retry and migration handling. |
| UX-11 | P1 | Panel, theme, mode, workout resume, and Bible reading continuity rely at least partly on browser storage. | Moving to subdomains can appear to reset settings or lose local work. | Migrate account preferences and recoverable work before making the new addresses primary. |
| UX-12 | P1 | Bible uses browser speech synthesis; Buddy has a cloud narration engine. | Bible does not get the voice quality requested by the owner. | Use Buddy's engine for scripture, with exact text, adult narration, cancellation, speed, and continuation. |
| UX-13 | P1 | Bible dashboard has a conditional Resume button, another Continue link, daily rotating book, fixed John/Psalms shortcuts, then plans and streaks. | Reading competes with multiple similar starting choices. | One dominant Continue reading action, followed by today's plan, then Browse Scripture. |
| UX-14 | P1 | Bible chat receives messages plus a general theological system prompt. The route does not retrieve and bind an authoritative passage or translation itself. | Requests for grounded study depend on model recall and client-provided context. | Retrieve the selected passage server-side, validate references, and distinguish quotation, interpretation, and application. |
| UX-15 | P1 | Travel `WatchList` hides itself during loading and when empty; fetch failures are ignored. Deletion removes a row before checking the server response. | A failure can look like missing alerts; a failed delete can appear successful. | Distinguish loading, empty, and unavailable; restore failed changes and offer retry. |
| UX-16 | P1 | Finance's account-load error panel exposes the database error and migration instructions. Travel's unconfigured banner names provider tokens. | Family members see operational details without an action they can take. | Show useful recovery text to users and diagnostic details to administrators. |
| UX-17 | P2 | Platform skin reduces group labels to 10.5px and tile labels to 10px, with uppercase and tracking. Some avatar/verse/news controls are also small. | Secondary information becomes harder to read and touch targets require verification. | Raise meaningful labels, enlarge hit areas, and test text zoom, focus, contrast, and long titles. |

The repository also retains `PlatformMenu`, `BottomNav`, HealthSubNav, and an eleven-tab CareerSubNav. The current Health and Career layouts inspected do **not** mount those subnav components. They are a maintenance concern, not proof that users currently see eleven Career tabs. Consolidate the active navigation contract and remove unused variants after verifying all references.

## Core feature review and target flows

### Panel — conversation first, comparison on demand

Current strengths: streaming model responses; per-model waiting states; Stop; files and images; conversation history; merged answers; export; model selection; estimated costs and a session budget. The current response grid already adapts its columns; retain that advantage.

Target layout: a collapsible history sidebar, central conversation, and optional output/document pane. Keep New conversation and conversation search in the sidebar. Keep the composer attached to the conversation and visible above the mobile keyboard. Put model selection, attachments, and concise estimated cost near Send; group advanced controls in one place.

Start in a readable conversation view. Provide an explicit Compare action that opens model answers alongside one another on desktop and a clearly labeled answer selector on mobile. Preserve attribution when presenting a merged answer. A document or generated output should open in a persistent workspace pane with copy, download, and return-to-conversation controls.

Make incomplete runs recoverable: preserve successful answers when another model fails, show which model failed, and offer retry for that model. Display server-save state. Require confirmation or undo for clearing conversation history. Keyboard focus should enter dialogs, remain within them, and return to the invoking control; Escape handling alone is insufficient evidence that focus is managed.

Acceptance: opening `panel.morrisai.family` lands in Panel; a new conversation is one action away; history survives device changes after successful sync; Stop prevents late audio/network results from restarting work; selected models and spending context remain understandable on a phone.

### Student Support and Buddy — different views for different people

Current strengths: age-tiered workspaces, child-specific activities, weekly organization, newsletter imports, parent search, progress, voice tutoring, and parent conversation transcripts. Buddy already includes large playful actions, clear listening/talking states, a stop control, and limits on hands-free conversation. Preserve those behaviors.

Parent home should answer: what is due, what needs help, and what changed this week? Show a child switcher, a short weekly summary, and three prominent actions: Add school update, Review tasks, and Open child view. Put imports, documents, historical detail, and customization behind those workflows rather than asking parents to browse a large collection of sections.

Child home should offer three or four large activities, such as Talk to Buddy, Practice words, Read with me, and My next task. Each activity should explain what happens next with one short sentence and an optional spoken instruction. Use short sessions, gentle celebrations, and visible progress toward a small goal. Provide replay, try again, and an obvious way to finish. Keep adult settings behind a parent entrance.

Use a friendly mascot consistently. Animation should explain states or celebrate completion, respect reduced-motion preferences, and never obscure a task. A microphone should visibly indicate listening, thinking, speaking, and stopped. A denied microphone permission needs an easy typing or tap-based alternative. Explain parent visibility in age-appropriate language.

Acceptance: a child can start a relevant activity without reading an administrative dashboard; a parent can add a school update and identify the next task; Buddy has a clear Stop in every speaking/listening state; returning tomorrow opens the right child and current week.

### Health — fast front door, deeper records

Current strengths: device synchronization, source timestamps, source-aware activity aggregation, meal logging, medications, wellness, medical records, workout history, workout resume, and an advisor. The health dashboard already avoids summing Apple and Oura daily totals indiscriminately; preserve clear data provenance.

Target home: a concise Today summary, a small number of chosen metrics, the next health action, and four useful shortcuts: Log meal, Log medication, Start/resume workout, Add record. Offer recent values and defaults before asking for repeated typing. A quick log should confirm success immediately and offer edit or undo.

Use local navigation such as Today, Track, Records, and Insights. Keep medication detail, historical labs, training plans, body composition, and export accessible within those areas. Show source and freshness beside important readings. Missing, stale, and zero values must remain distinct. Connection repairs belong in a dedicated action, with one clear explanation rather than repeated setup prompts.

Acceptance targets: repeating a previous meal or logging a scheduled dose requires at most two meaningful actions after opening Health; an interrupted workout can resume; a failed import retains its input and offers retry; a stale measurement is labeled; medical records retain dates, units, reference ranges, and their source document. These are UX targets, not treatment guidance.

### Bible — a quiet reading experience with grounded study

Current strengths: translations, verse-level highlights and notes, bookmarks, plans, reading continuity, chapter queues, reading aloud, and family challenges. Preserve those capabilities behind a calmer hierarchy.

Home should have one Continue reading card showing book, chapter, and translation; today's plan beneath it; then Browse Scripture and Search. Put streaks, challenges, and older notes below reading. Remove arbitrary passage shortcuts from the primary hierarchy unless the user pins them.

The reader should emphasize the scripture text and reference. Keep translation, text size, and Listen easy to reach; show notes/highlights on verse selection. Use a compact audio player with play/pause, next passage, speed, and clear buffering/retry states. Save place, selected translation, and reading appearance. Avoid a play icon competing with the text on every verse; offer Read from here when a verse is selected.

Use the newer Buddy engine with a calm narration style. Spoken scripture must come from the retrieved translation's exact verse text. Do not insert summaries, invented transitions, or study commentary into the reading. Label chapter announcements separately. Long chapters need chunking, cancellation, continuation, and playback recovery; real-device checks must include iPhone/iPad Safari and background interruptions.

Grounded study should open beside the selected passage. Bind book, chapter, verse range, translation, and passage text to the request. Show related references users can open. Separate Scripture, Explanation, and Application. Acknowledge interpretive differences. Avoid asserting that a generative response is authoritative commentary. If the reference or source text is unavailable, say so and offer the passage reader instead of manufacturing a quotation.

The current chat prompt already asks for references and fair treatment of traditions; retain that intent, but prompt instructions alone do not establish retrieved-source grounding. Translation licensing and availability should be reflected accurately in the product. An unavailable translation should show an alternative and retry; the reader currently exposes a `BIBLE_API_KEY` setup instruction that should be administrator-only.

Acceptance: one action resumes reading; switching translations keeps the same reference; audio reads the displayed text; Stop prevents the next prefetched clip or chapter from starting; the selected translation survives continuation; a study answer's references open the cited passages.

### News — breadth without a wall of headlines

Current strengths: general topics, local news, company news, RSS subscriptions, sports, publication labels, and external article links. The dedicated `/news` page exists and Today includes a News shortcut. The problem is the news experience and its persistent placement, not the absence of any entry point.

Make News a permanent app destination at `news.morrisai.family`. Default sections: Top stories, Local, US, World, Business, Technology & AI, Science & Health, Sports, and Following. Let people customize these without requiring a trip through home-widget settings.

Give the opening view a short dated briefing followed by a scannable headline list. Use explicit section filters, story search, Save for later, and Load more. Cluster duplicate coverage of the same event; show source, publication time, update time where available, and links to additional reporting. Breadth should include both topic breadth and independent source coverage. Explain personalization and let users switch to an unpersonalized top-stories view.

Treat AI summaries as labeled summaries tied to retrieved articles. Keep original links visible. Do not present missing source dates as a fresh publication time. `lib/news.ts` currently substitutes the current time for missing/invalid RSS dates; use Unknown publication time instead. Distinguish a failed feed from a feed with no new articles. Preserve the last successful briefing with its real update time.

Acceptance: News is one action away from every app; changing Today widgets does not disable News; a reader can browse major sections without setup; more than eight subscription stories are reachable; repeated coverage is grouped; each summary has accessible sources and a truthful freshness label.

### Finance and retirement

Preserve account connectivity, manual accounts, sharing, duplicate review, budgets, insights, PIN controls, and retirement modeling. Simplify the home hierarchy to Overview, Accounts, Spending, and Plan. Make current owner/scope and sync status visible near totals. Separate personal and household totals explicitly.

Keep retirement's robust inputs, scenarios, and projections, but provide a guided initial setup and a projection summary before advanced tables. Make assumed values visibly distinct from entered values. Show whether changes are saved, and offer scenario comparison. Replace database diagnostics with a plain account-load error, last known data where appropriate, and retry.

Acceptance: users can identify which accounts contribute to a total, recover a disconnected bank, distinguish manual from synced balances, and save a scenario without wondering whether their changes persisted.

### Investments

Preserve research, watchlists, ideas, connected accounts, and paper/live support. The home subtitle emphasizes paper trading, while connection setup supports live trading too; show actual account mode persistently. A two-point sparkline made from previous and current equity is a comparison, not a historical trend; label it or replace it with real dated observations.

Use Overview, Watchlist, Research, and Ideas. Show source/time with market information. Keep research adjacent to the security being researched, preserve the query, and make portfolio/account context clear. Advanced idea filters should collapse after selection and offer a visible Reset.

Acceptance: the user always knows the active account and mode, can return to a saved research result, and can tell current data from cached or unavailable data. This review does not evaluate investment recommendations.

### Career

Preserve goals, experiences, relationships, learning, profile, advisor, certifications, and timeline. Lead with the next meaningful development action and progress against a chosen goal. Explain the 70/20/10 framework in plain language and move it below the action summary; the current hero compares counts with different meanings and time scopes, so it should not imply measured time allocation.

Use Goals, Experience, Network, Learning, and Advisor. Link certifications into the broader learning area; place LSAT under Student Support while retaining old links. Show a short setup path for missing profile context. Keep Career as a professional development app with a clear home.

### Family, tasks, settings, and onboarding

Keep Family focused on shared calendar, assignments, shopping, meals, and goals. Member rows currently all link to the generic preview picker; when a person is selected, open that person's view directly. Keep personal/family scope visible and stable when changing apps.

Use one settings home with Account, Appearance, Voice, Connections, Notifications, Family & Sharing, Privacy, and Administration. Module-specific settings should link back to it. Allow users to enter an app before completing optional interests and integrations; the existing five-step onboarding can defer those steps and resume from a dismissible checklist. Preserve progress and give connection failures a retry that does not restart onboarding.

## Proposed subdomain contract

All hosts below are **proposed**, not deployed by this review. Serve them from the existing Morris Hub application initially; separate repositories or deployments are not necessary merely to give features their own addresses.

| Host | App and internal entry point | Notes |
| --- | --- | --- |
| `morrisai.family` | Public entry and canonical sign-in | Signed-in users can open Hub. Choose one canonical apex/www policy. |
| `hub.morrisai.family` | Today — `/home` | Personalized overview and app launcher. |
| `panel.morrisai.family` | Panel — `/home/ask/compare` | A primary destination, not a submenu label. |
| `ask.morrisai.family` | Ask Morris — `/home/ask` | Include image creation as a local tool. |
| `health.morrisai.family` | Health — `/health` | Include workouts, nutrition, medications, and records. |
| `finance.morrisai.family` | Finance — `/finance/dashboard` | Include budgets, insights, retirement, portfolio, and tax. |
| `investments.morrisai.family` | Investments — `/investments` | Account mode stays visible. |
| `career.morrisai.family` | Career — `/career` | Certifications remain accessible. |
| `student.morrisai.family` | New Student Support overview | Unifies courses, child workspaces, and academic practice; this overview does not yet exist. |
| `buddy.morrisai.family` | Child resolver — `/children/buddy` | Open the right child activity after selection/authorization. |
| `bible.morrisai.family` | Bible — `/bible/dashboard` | Reading, plans, search, notes, and study. |
| `travel.morrisai.family` | Travel — `/travel` | Planning, search, trips, travelers, loyalty, and alerts. |
| `news.morrisai.family` | News — `/news` | Independent of home widgets. |
| `family.morrisai.family` | Family — `/home/family` | Calendar, shopping, meals, and goals. |
| `tasks.morrisai.family` | Tasks — `/home/tasks` | Shared and personal scope remains explicit. |
| `journal.morrisai.family` | Journal — `/home/journal` | Private by default as authorized by existing access rules. |
| `settings.morrisai.family` | Settings — `/settings` | One shared account/preferences experience. |
| `admin.morrisai.family` | Administration — `/home/admin` | Existing role checks must remain enforced. |

Use a single registry for app name, host, entry route, icon, and visibility rules. Do not scatter absolute links across components. A shared app launcher should show all entitled apps and explain unavailable apps where appropriate. Feature subpages stay under their parent app; a separate host for every setting or action would make navigation harder.

Host routing must distinguish app pages from `/api`, `/auth`, framework assets, images, and metadata. Existing code uses absolute internal paths such as `/bible/read/...` and `/finance/retirement`; a blanket prefix rewrite would double-prefix these and break cross-app links. Define and test both legacy internal paths and clean external paths. Unknown hosts should not inherit arbitrary routes.

Login should return to the originating host and exact destination using an explicit allowlist. Coordinate auth cookies, callback URLs, and logout across approved hosts. `NEXT_PUBLIC_COOKIE_DOMAIN` support in the proxy is only one piece; its existence is not evidence that production is configured. Avoid assuming localStorage, service workers, or session history are shared across hosts. Migrate settings and local work, and provide contextual Back/Home behavior for direct links without browser history.

Use the DNS records returned for each actual Vercel domain assignment. Preserve email and verification records. A DNS write, certificate issuance, routing, app entitlement, and successful sign-in are separate checks. References: [Vercel custom domain configuration](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls), and [browser origin-specific storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

## Visual system and delivery sequence

Keep a recognizable Morris identity across apps, with one restrained accent per module. Use legible sans-serif controls, comfortable reading typography, clear surface contrast, useful spacing, and consistent action placement. A full-screen phone simulation should not determine a desktop workspace. Reserve playful illustration and motion for Buddy and learning; keep Health calm, Bible quiet, Panel focused, and News editorial and scannable.

1. **Foundation:** app registry, host routing, destination-preserving login, shared app launcher, consistent names, migrated preferences, and a shared voice player.
2. **Priority daily experiences:** Panel workspace, Buddy/Student role-specific homes, Health quick actions, reading-first Bible, and independent News.
3. **Depth and recovery:** record imports, research, retirement, travel, offline/failed-sync handling, and saved-work status.
4. **Validation and rollout:** test old and new URLs, then publish feature hosts in batches with a route-level rollback plan.

Release checklist: direct deep links while signed out and signed in; account approval and denied access; two users on a shared device; sidebar/launcher keyboard use; 320/390/768/1440px layouts; 200% zoom and long text; modal focus; reduced motion; slow/offline/failed API states; voice cancellation while loading; translation and chapter continuity; microphone denial; actual source freshness; old bookmarks and installed-app behavior. Target LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1 at the 75th percentile once real measurements are available.

## Follow-on implementation in this working copy

The owner's explicit request to extend Buddy's newer voice is implemented in this branch separately from the redesign proposals. It adds a shared authenticated narration endpoint and cancellable player, connects Bible and certification study narration, exposes cloud voices through platform preferences, and updates Bible/platform voice controls. It retains Buddy's existing child-oriented voice behavior and uses a separate verbatim adult narration style for scripture and study text. Verification includes 14 focused playback/API tests and a Chromium smoke test using real audio playback with fixture responses. The test suite covers authentication, input limits, cache reuse, provider failure, exact-text narration, cancellation, pause/resume during loading, verse order, speed, and device fallback. Actual provider audio quality, production database integration, and iPhone/iPad background playback remain unverified. Run `npm run test:voice` and `npm run test:voice:browser`; the browser test accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when the environment supplies its own Chromium. The final standard Turbopack production build passed, including TypeScript validation and generation of 144 static pages. The alternative webpack build exposed an unchanged pre-existing global-selector issue in the retirement print CSS; the production Turbopack build passed. No production deployment or DNS changes are included.

## Primary source map

For immutable source evidence, prepend `https://github.com/tmorr16-coder/morris-hub/blob/2137cf19620773806c13e14bb6f492bcd5f4d5db/` to these paths:

- Foundation: `next.config.ts`, `proxy.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/layout.tsx`, `app/ios.css`, `app/platform.css`, `components/ios/TabBar.tsx`, `components/GlobalBackButton.tsx`, `components/NavModeProvider.tsx`.
- Entry and tools: `app/page.tsx`, `app/home/page.tsx`, `app/home/_components/QuickActions.tsx`, `app/home/more/page.tsx`, `app/home/ask/compare/page.tsx`, `app/home/ask/compare/CompareClient.tsx`.
- Learning: `app/children/page.tsx`, `app/children/_components/ElementaryWorkspace.tsx`, `app/children/_components/KidClient.tsx`, `app/home/me/courses/page.tsx`, `app/career/page.tsx`, `app/career/layout.tsx`.
- Health and money: `app/health/page.tsx`, `app/health/train/page.tsx`, `app/finance/dashboard/page.tsx`, `app/finance/retirement/_components/RetirementClient.tsx`, `app/investments/page.tsx`, `app/investments/_components/AlpacaCard.tsx`.
- Bible: `app/bible/dashboard/page.tsx`, `app/bible/read/[bookId]/[chapter]/ChapterReader.tsx`, `app/bible/read/[bookId]/[chapter]/page.tsx`, `app/api/bible/chat/route.ts`.
- News/travel/family: `app/news/page.tsx`, `lib/news.ts`, `app/home/_components/NewsClient.tsx`, `app/home/_components/NewsSubscriptionsClient.tsx`, `app/travel/page.tsx`, `app/travel/_components/WatchList.tsx`, `app/home/family/page.tsx`.

Public positioning was checked at [morrisai.family](https://www.morrisai.family/). Configuration evidence came from the connected Vercel project's domain list and ready production deployment record; neither a cached public-page read nor a source review substitutes for authenticated device testing.
