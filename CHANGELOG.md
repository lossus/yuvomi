# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.20.43] - 2026-04-21

### Added
- `POST /api/v1/auth/setup` bootstrap endpoint: creates the first admin user when no users exist, enabling Docker-based deployments to initialise via HTTP without direct filesystem DB access. Returns 403 once any user exists.

## [0.20.42] - 2026-04-21

### Added
- `.claude/` tooling committed with the repo: skills (`release-prep`, `fix-issue`, `pr-review`, `issue-triage`), subagents (`pr-reviewer`, `repo-auditor`), path-scoped rules (`server-routes`, `public-pages`, `tests`, `db-migrations`), and a PostToolUse hook (`block-innerhtml.sh`) that enforces the innerHTML ban on save. Contributors using Claude Code now get the same guardrails and workflows automatically.

### Changed
- `.gitignore`: no longer excludes the entire `.claude/` directory — only `.claude/settings.local.json` and `.claude/worktrees/` stay out, so shared tooling is versioned while local permissions remain private.

## [0.20.41] - 2026-04-21

### Fixed
- Race condition in `router.js`: when `auth.me()` failed during initial navigation, `_pendingLoginRedirect` was not cleared before calling `navigate('/login')` from the catch block, causing the `finally` handler to launch a second concurrent navigation. If the second navigation was still in progress when the user submitted the login form, `navigate('/', user)` was silently blocked — login appeared to succeed but the dashboard never loaded (most noticeable on iOS Safari PWA with iCloud Keychain autofill)

### Added
- Version number displayed on the login page (fetched from new `GET /api/v1/version` endpoint, no auth required), so users can verify which release their PWA is running

## [0.20.40] - 2026-04-21

### Changed
- `docs/SPEC.md` Design System → Colors: replaced outdated code block with current Indigo-based palette (`#4F46E5` primary, module color semantics, priority/severity separation, dark mode Indigo-400 accent, `--glass-inset-*` specular tokens); added palette rationale and WCAG contrast notes inline

## [0.20.39] - 2026-04-21

### Changed
- `docs/SPEC.md`: document `ics` as a valid `external_source` value, add `subscription_id` and `user_modified` columns to Calendar Events data model, add ICS Subscriptions table definition, expand Calendar module section with ICS subscription feature details, update Settings section
- `README.md`: update Calendar Sync highlight to mention ICS/webcal URL subscriptions

## [0.20.38] - 2026-04-21

### Added
- ICS-URL calendar subscriptions: any user can subscribe to external calendars via HTTPS or webcal:// URL
- Per-subscription visibility (private or shared with all family members), custom color, and manual sync trigger
- REST API: `GET/POST /api/v1/calendar/subscriptions`, `PATCH/DELETE /api/v1/calendar/subscriptions/:id`, `POST /api/v1/calendar/subscriptions/:id/sync`
- `POST /api/v1/calendar/:id/reset` endpoint to clear `user_modified` on ICS events, allowing the next sync to restore upstream data
- ICS visibility filter on `GET /api/v1/calendar` and `/upcoming`: private subscription events are hidden from other users
- ICS subscription management card in Settings → Kalender tab (below Apple Calendar): subscription list with color dot, visibility badge, last-sync timestamp; inline add form with URL, name, color picker, and shared toggle; sync and delete actions
- "Auf Original zurücksetzen" link in calendar event popup for user-modified ICS events
- `user_modified = 1` is set automatically when any externally-sourced event (ICS, Google, Apple) is edited by the user
- ICS sync integrated into the periodic `runSync()` scheduler alongside Google and Apple Calendar
- All new UI strings in `public/locales/de.json` under `settings.ics.*` and `calendar.ics.*`

## [0.20.37] - 2026-04-20

### Added
- `server/services/ics-subscription.js`: core ICS subscription service with SSRF-protected fetch (DNS pre-resolution against private IP ranges), ETag/Last-Modified conditional fetching, 10 MB response size limit, 15 s timeout, webcal:// → https:// normalization, RRULE expansion via sync window (−6 / +12 months), upsert-on-conflict with `user_modified` guard, stale-event cleanup via `json_each`, and in-memory mutex to prevent concurrent syncs of the same subscription

## [0.20.36] - 2026-04-20

### Added
- Migration v10: new `ics_subscriptions` table with fields for name, URL, color, shared flag, created_by, etag, last_modified, last_sync, and created_at
- Migration v11: `calendar_events` table recreated to extend the `external_source` CHECK constraint to include `'ics'`, and two new columns added — `subscription_id` (FK to `ics_subscriptions` with CASCADE delete) and `user_modified` (integer flag, default 0)
- Unique partial index `idx_calendar_sub_extid` on `(subscription_id, external_calendar_id)` prevents duplicate UIDs within a single ICS subscription while allowing the same UID across different subscriptions
- `test:ics-sub` test suite with 10 tests covering subscription CRUD, ICS event insertion, UNIQUE constraint enforcement, cascade delete, visibility filtering, and CHECK constraint validation

## [0.20.35] - 2026-04-20

### Changed
- Extracted ICS parser functions (`unfoldLines`, `parseICS`, `formatICSDate`, `tzLocalToUTC`, `applyDuration`) from `apple-calendar.js` into a new shared module `server/services/ics-parser.js`, plus a new `expandRRULE` helper — pure refactor, no logic changes
- Added `test:ics-parser` test suite covering line unfolding, all-day/UTC event parsing, and RRULE expansion

## [0.20.34] - 2026-04-20

### Fixed
- Login on Safari/iOS PWA no longer loops back to the login screen when credentials are wrong: `apiFetch` no longer dispatches `auth:expired` for 401 responses from `/auth/login` (where 401 means invalid credentials, not expired session) — the error message is now shown correctly instead of the form being silently re-rendered

## [0.20.33] - 2026-04-20

### Fixed
- Weather widget: forecast min/max temperatures are now aggregated across all 3-hour intervals of each day instead of reading `temp_min`/`temp_max` from a single snapshot — the OWM free-tier `/forecast` endpoint reports near-identical values per 3h window, so min and max were always the same; icon and description still use the noon entry (12:00, fallback 15:00)

## [0.20.32] - 2026-04-20

### Changed
- Dark mode switched from blue-tinted (Option B) to deep warm (Option A): background `#1A1A18`, cards `#222220`, sidebar `#141413` — warmer and more inviting feel

## [0.20.31] - 2026-04-20

### Fixed
- Toast success/warning/danger now use dark text in dark mode — previously white text on vivid lime/amber/pink backgrounds had contrast ratios of ~1.3–1.5:1 (unreadable); now 13–15:1 (WCAG AAA)
- List stagger animation tapers naturally (35→30→25→22→18→15→12→9→7ms steps) and covers 9 items before capping, replacing the abrupt constant 175ms from item 6 onward

## [0.20.30] - 2026-04-20

### Changed
- Desktop body font size increased from 14px to 15px (`--text-base`) for improved readability
- Interactive cards now show a stronger pressed state on touch (scale 0.98 + surface-3 background) instead of the barely-perceptible scale(0.99)

### Fixed
- Added clarifying comment to `--color-surface-2` token explaining its recessed/sunken semantics (darker than background in dark mode, not an elevation level)

## [0.20.29] - 2026-04-20

### Changed
- Dark mode now uses a blue-tinted color palette (Option B): background `#0F1117`, surfaces `#161A26`/`#1E2336`, sidebar `#0B0D14` — creates stronger visual hierarchy and complements the Indigo accent

### Fixed
- Defined missing CSS tokens `--color-surface-elevated` and `--color-surface-hover` used by More-Sheet items, Search overlay inputs and results (previously transparent/invisible backgrounds)

## [0.20.28] - 2026-04-20

### Fixed
- Dark mode "System" setting now reliably follows the OS preference on every page load, even in browsers where JavaScript `matchMedia` is restricted (e.g. Brave with fingerprint protection); CSS `@media (prefers-color-scheme: dark)` now serves as the authoritative source for system preference detection instead of JS

## [0.20.27] - 2026-04-20

### Fixed
- Selecting "System" theme in settings now immediately applies the OS dark/light preference instead of reverting to light mode until the next page reload

## [0.20.26] - 2026-04-20

### Added
- Meals: floating action button (FAB) now appears fixed at the bottom-right corner, opening a quick-add modal for today with the first visible meal type pre-selected

## [0.20.25] - 2026-04-20

### Fixed
- Theme selection no longer reverts to light mode on page reload when "System" is chosen; the init script now correctly resolves the `system` preference to the OS dark/light state instead of treating it as a literal `data-theme` value

## [0.20.24] - 2026-04-20

### Added
- Tasks: subtle green edge indicator on touch devices hints at the swipe-left gesture without requiring an actual swipe (hidden during active swipe)
- Global search: new search overlay accessible from the "More" sheet — searches tasks, calendar events, and notes simultaneously; results link directly to the relevant record
- Navigation: bottom bar now shows 4 primary items plus a "More" button that opens a slide-up sheet with remaining sections and the search entry point; replaces the old 2-page swipe approach

### Changed
- Server: `VALID_CATEGORIES` in tasks route updated to English keys to match the v9 DB migration

## [0.20.23] - 2026-04-20

### Added
- Tasks: filter bar replaced by a compact toggle panel — only active filter chips are shown inline; a "Filter" button (with active-count badge) opens a grouped panel with Status, Priority, and Person sections, plus a clear-all button

### Changed
- Tasks: category values stored in the database are now English keys (`household`, `school`, `shopping`, `repair`, `health`, `finance`, `leisure`, `misc`) instead of German strings — migration v9 converts all existing rows automatically; display labels are unchanged

## [0.20.22] - 2026-04-20

### Added
- Tasks: Kanban board now supports touch drag-and-drop on mobile — a ghost card follows the finger and drops into the target column on release
- Tasks: swipe-left to mark done/open now shows a 5-second undo toast that reverts the status change
- Tasks: opening a task card from the Dashboard now navigates to `/tasks` and immediately opens the edit modal for that task (deep-link via `?open=<id>`)

### Fixed
- Router: query parameters (e.g. `?open=123`) are now stripped before route matching, so parameterised URLs resolve correctly without falling back to the home page

## [0.20.21] - 2026-04-20

### Changed
- Dashboard: eliminated double-render flicker — initial paint uses skeleton widgets and a stat-less greeting; real widgets replace skeletons in-place without resetting `container.innerHTML`
- Dashboard: weather widget now derives temperature unit symbol (°C / °F / K) from the `units` field returned by the weather API instead of always showing °C
- Dark mode: removed duplicate `@media (prefers-color-scheme: dark)` block from `tokens.css`; system-preference detection moved to a `matchMedia` listener in `index.html` for flash-free sync
- Tasks: view-toggle (list / Kanban) fades out at 40% opacity during re-render and fades back in, giving visible feedback of the switch

### Fixed
- Tasks: inline `style="width/height"` on all Lucide icon instances replaced with utility CSS classes (`icon-xs` … `icon-2xl`, `icon-11`) defined in `layout.css`
- Tasks: edit-button inline size overrides removed; replaced with new `.btn--icon-sm` utility class
- Tasks: `textarea` `resize: vertical` and select `min-height: 44px` moved from inline styles to `layout.css`
- Dashboard: `chipIcon` inline style variable eliminated; chip icons now use `class="icon-sm"`
- Dashboard: settings, refresh, chevron, and other action icons converted from inline styles to CSS classes
- Weather API: server now forwards the configured `units` value in the response payload so the frontend can render the correct unit symbol

## [0.20.20] - 2026-04-20

### Fixed
- Accessibility: `--module-notes` color raised from `#CA8A04` (4.08:1) to `#A16207` (6.3:1) — now WCAG AA compliant for normal text including nav labels
- Accessibility: Task status button `aria-label` now reflects actual action — says "mark as open" for completed tasks instead of always "mark as done"
- i18n: Added `tasks.markOpen` key to all 15 locale files for the corrected aria-label

## [0.20.19] - 2026-04-20

### Changed
- Design: two hardcoded color values in `dashboard.css` replaced with design tokens — `drop-shadow(0 2px 4px rgba(0,0,0,0.15))` on `.weather-widget__icon` replaced with new `--shadow-drop-icon` token; `rgba(0,0,0,0.25)` on `.fab-backdrop` replaced with new `--color-backdrop-fab` token
- Design: `--shadow-drop-icon` and `--color-backdrop-fab` added to `tokens.css` (shadow and overlay sections respectively)

## [0.20.18] - 2026-04-20

### Changed
- Meals: Zutaten-Kategorien im Mahlzeiten-Dialog auf lebensmittelrelevante Kategorien beschränkt (Haushalt und Drogerie ausgeblendet)
- Refactoring: Kategorie-Übersetzungslogik (`categoryLabel`) und `DEFAULT_CATEGORY_NAME` in neues geteiltes Utility `public/utils/shopping-categories.js` ausgelagert; Shopping- und Meals-Seiten nutzen nun die gemeinsame Implementierung

## [0.20.17] - 2026-04-20

### Changed
- Design: dark-mode token architecture refactored to private-variable indirection (`--_name`) in `tokens.css` — all tokens with dark-mode overrides now have a private `--_token` variant that holds the actual value, while public tokens (`--color-*`, `--module-*`, `--glass-*` etc.) are stable `var(--_token)` references. Both dark blocks (`@media prefers-color-scheme: dark` and `[data-theme="dark"]`) now only override the compact private tokens; the public API never needs to be touched again for dark-mode changes. The redundant explicit `--color-surface-2` override was removed from both dark blocks (it is already correctly derived via `var(--neutral-50)`). No visual change.

## [0.20.16] - 2026-04-19

### Changed
- Design: PWA `theme-color` meta tag updated from `#2563EB` to `#4F46E5` (Indigo-600) to match the new primary accent; install-prompt CSS fallback updated from `#2554C7` to `#4338CA`, and hardcoded `#fff` replaced with `var(--color-text-on-accent, #fff)`
- Design: five new `--glass-inset-*` tokens added to `tokens.css` (`--glass-inset-soft` 0.18, `--glass-inset-base` 0.20, `--glass-inset-medium` 0.22, `--glass-inset-elevated` 0.28, `--glass-inset-strong` 0.32); ten hardcoded `inset 0 1px 0 rgba(255,255,255,…)` literals in `glass.css` and `tasks.css` replaced with the corresponding token references — no visual change
- Design: `@media print` block in `layout.css` normalised from CSS shorthand hex (`#fff`, `#000`, `#ddd`) to explicit six-digit notation (`#ffffff`, `#000000`, `#cccccc`) for consistency

## [0.20.15] - 2026-04-19

### Changed
- Design: primary accent migrated from `#2563EB` (Tailwind Blue-600) to `#4F46E5` (Indigo-600) for a warmer, more distinctive tone that harmonises with the existing warm-neutral surface palette and `--color-accent-secondary`; all Indigo-family tokens updated accordingly across light and dark mode
- Design: module accent colours decoupled from severity colours — Meals moved to Orange-700 (`#C2410C`), Shopping to Pink-600 (`#DB2777`), Budget to Teal-700 (`#0F766E`); previous Orange sharing between Meals, Shopping, Warning and Priority-Medium made badges semantically ambiguous
- Design: Warning (`#A15C0A`) and Danger (`#B91C1C`) raised to higher contrast ratios (5.2:1 and 6.9:1 respectively) for improved readability on white
- Design: Priority-Medium separated into Amber-700 (`#A16207`, 6.3:1) so it is visually distinct from Warning and Meals in the same row
- Design: dark-mode accent shifted to Indigo-400/500 (`#818CF8`/`#6366F1`) to preserve hue identity from light mode instead of the previous hue-shifted Sky-Blue

### Fixed
- Tasks: overdue badge base styles (background colour, size, border-radius) moved from the dynamically-unloaded `tasks.css` to `layout.css`, so the badge remains visible in the navigation bar on every page, not just while the Tasks page is active (closes #56)
- Tasks: subtask checkbox icon refactored from inline `style="color:#fff"` to `.subtask-item__checkbox-icon` CSS class using `var(--color-text-on-accent)`
- Reminders: three stale CSS fallback values removed (`var(--color-priority-urgent, #EF4444)`, `var(--color-accent, #2563EB)`, `var(--color-border, rgba(0,0,0,0.1))`); `color: #fff` replaced with `var(--color-text-on-accent)`
- Dashboard: widget customise button glass highlight replaced with existing `--color-glass*` tokens instead of hardcoded `rgba(255,255,255,…)` literals

### Accessibility
- `prefers-contrast: more` block now overrides `--module-notes` to `#A16207` (6.3:1) to meet AA normal-text threshold in high-contrast mode

## [0.20.14] - 2026-04-19

### Fixed
- Tasks: overdue badge now consistently overlays the top-right corner of the nav icon in all three layouts (mobile bottom nav, collapsed sidebar, expanded sidebar). Root cause: the badge was positioned absolutely relative to the full-width `.nav-item` flex container, causing misalignment. Fixed by wrapping the icon SVG in a `.nav-item__icon-wrap` span at runtime and appending the badge there instead (closes #56)

## [0.20.13] - 2026-04-19

### Added
- Budget: income entries now have dedicated categories (Earned Income, Investment Income, Transfer & Gift Income, Government & Social Benefits, Other Income) separate from expense categories; the category dropdown in the budget modal updates dynamically when switching between income and expense types (closes #55)
- Budget: all 15 supported locales include translations for the new income categories

## [0.20.12] - 2026-04-19

### Fixed
- Tasks: active filters are now correctly re-applied when navigating away from and back to the Tasks tab. Previously the filter chip appeared active but all tasks were shown, because the initial data fetch in `render()` always called `/tasks` without query parameters, ignoring the persisted `state.filters`. Fixed by building the filter query in `render()` the same way `loadTasks()` does, so the first fetch already respects the current filter state (closes #49)

## [0.20.11] - 2026-04-19

### Fixed
- PWA: modal header (task / calendar event) no longer scrolls out of view when the form content exceeds the modal height. Root cause: `position: sticky` on `.modal-panel__header` fails on iOS WebKit when the scroll container (`.modal-panel`) has `padding-top` applied (a known WebKit quirk). Fixed by restructuring the modal layout: `.modal-panel` is now a `flex-column` container with `overflow: hidden`, and scrolling is handled by `.modal-panel__body` (`overflow-y: auto; flex: 1`). The header is always visible as a non-scrolled flex sibling. Swipe-to-close updated to read scroll position from `.modal-panel__body` instead of `.modal-panel` (closes #50)

## [0.20.10] - 2026-04-18

### Changed
- Upgraded Express 4 → 5 (`^5.2.1`): modernised wildcard SPA fallback route from `'*'` to `'/{*path}'` for compatibility with path-to-regexp v8; all other Express APIs in the codebase were already Express 5 compatible (closes #54)

## [0.20.9] - 2026-04-18

### Added
- Ukrainian (uk) translation (closes #52)
- Ukrainian Hryvnia (UAH) currency option in budget settings
- Shopping list category names are now translated in the settings panel; rename and delete dialogs also use the translated name

### Fixed
- Server-side `VALID_CURRENCIES` now matches the frontend list — `AED`, `BRL`, `INR`, and `SAR` were accepted by the UI but rejected by the API

## [0.20.8] - 2026-04-18

### Changed
- Dependencies updated: `better-sqlite3` 9 → 12, `dotenv` 16 → 17, `express-rate-limit` 7 → 8, `express-session` 1.18 → 1.19, `helmet` 8.0 → 8.1, `googleapis` 144 → 171, `tsdav` 2.0 → 2.1 (closes #53)
- Added GitHub Dependabot configuration for automated weekly dependency updates

## [0.20.7] - 2026-04-16

### Fixed
- iOS PWA: large empty area visible between the bottom navigation bar and the physical screen edge. Root cause: `body::after` (which covers the home indicator safe area) had the same `z-index` as the nav bar (100) but was painted after all child elements by the browser's compositing order, causing it to render on top of the nav's glass background with a mismatched color (`color-mix` vs `var(--glass-bg)`). Fixed by aligning `body::after` to `var(--glass-bg)` and `var(--blur-md)` (identical to the nav) and lowering its `z-index` to `z-nav - 1` so the nav always renders on top in the overlap area.
- iOS PWA: app zoomed in when the virtual keyboard appeared and remained zoomed after the keyboard was dismissed, causing nav items and other elements to move outside the visible viewport. Added `focusin`/`focusout` listeners in `router.js` that temporarily set `maximum-scale=1` on the viewport meta tag while an `INPUT`, `TEXTAREA`, or `SELECT` is focused (prevents WKWebView auto-zoom), then restore `maximum-scale=5` after a 150 ms delay once the field loses focus (preserves manual zoom for accessibility).

## [0.20.6] - 2026-04-16

### Fixed
- Android PWA: page transitions were taking ~1 second, making navigation feel sluggish. Two root causes addressed: (1) `glass.css` extended the page-in animation duration from `0.20s` to `0.30s` with a spring easing (`ease-glass`) — reverted to `0.20s` in and `0.12s` out to match the layout baseline. (2) During transitions, dozens of `backdrop-filter` composited layers (widgets, task cards, inputs, toolbars) were all rendered simultaneously for both the outgoing and incoming page, overwhelming mid-range Android GPUs. Added `html.navigating` state: `router.js` sets this class for the duration of each page transition, and `glass.css` overrides all `backdrop-filter` in the content area to `none` for that window, then restores them once the animation ends (closes #48).

## [0.20.5] - 2026-04-16

### Fixed
- iOS PWA: persistent gap between the bottom navigation bar and the physical screen edge. Two root causes addressed: (1) `will-change: transform` on the flex-child nav caused iOS WebKit's compositor to misplace the GPU layer — removed permanently; CSS `transform` transitions work with hardware acceleration on modern iOS without this hint. (2) Added `-webkit-fill-available` as a height fallback before `100dvh` on `.app-shell` to guard against iOS WebKit versions where `100dvh` is computed slightly smaller than the actual WKWebView height.

## [0.20.4] - 2026-04-16

### Fixed
- iOS PWA: bottom navigation bar appeared visually higher than on Android. Changed `.nav-bottom` from `position: fixed` to a flex child of `.app-shell` (`position: relative; flex-shrink: 0`). With `position: fixed` and `will-change: transform` (used for the hide/show animation), iOS's compositor could misplace the nav bar. As a flex child at the end of a `height: 100dvh` container, the nav is guaranteed to sit flush at the physical screen bottom on all platforms. Removed the redundant `padding-bottom` clearance from `.app-content`, `.tasks-page`, and `.dashboard` (no longer needed since the nav no longer overlaps the content area).

## [0.20.3] - 2026-04-16

### Fixed
- iOS PWA: two visually distinct color zones at the bottom of the screen (below the bottom navigation bar). The `body::after` pseudo-element that covers the home indicator safe area now matches the bottom nav's appearance exactly - using the same semi-transparent background (`color-mix`) and `backdrop-filter: blur(16px) saturate(180%)` - so the navigation bar blends seamlessly into the bottom edge of the screen.

## [0.20.2] - 2026-04-16

### Fixed
- iOS PWA: "Dashboard kann nicht geladen werden" toast after opening the PWA due to an `auth:expired` race condition. When the session cookie was cleared by iOS between opens, the 401 response triggered `auth:expired` while navigation was still in progress (`isNavigating=true`), causing the redirect to `/login` to be silently dropped. A `_pendingLoginRedirect` flag now defers the redirect until navigation completes.
- SW cache bumped (shell v34, pages v29) to force iOS devices to pick up the previous CSRF fix that may still have been served from stale cache.

## [0.20.1] - 2026-04-15

### Fixed
- iOS PWA: recurring "forbidden" (403) errors caused by CSRF token desync after app resume. The server now sends the correct CSRF token as `X-CSRF-Token` response header on every API response (not just `/auth/me` and `/auth/login`). The client reads the header from every response - including 403 errors - enabling instant self-healing without an extra `/auth/me` round-trip. SW cache bumped to v33 to ensure iOS PWA users pick up the fix.

## [0.20.0] - 2026-04-15

### Added
- Reminders: set time-based reminders on tasks and calendar events (closes #13)
  - Tasks: enable a reminder with a custom date and time via the task edit modal
  - Calendar events: choose an offset (at time, 15 min, 1 hour, or 1 day before) via the event edit dialog
  - In-app toast notifications (built via DOM API, no external dependencies) appear when a reminder is due
  - Browser Notification API support - reminders fire as system notifications when permission is granted
  - Client-side polling every 60 seconds checks for pending reminders
  - Reminders can be dismissed individually; dismissed reminders no longer appear
  - Bell badge on each reminder shows pending count when reminders are due
  - DB migration #8 adds `reminders` table with `entity_type`, `entity_id`, `remind_at`, `dismissed` fields and appropriate indexes

## [0.19.6] - 2026-04-15

### Added
- Meals: ingredient category selection when adding ingredients to a meal - each ingredient can now be assigned a shopping category (e.g. Fruit & Vegetables, Dairy, Meat & Fish) directly in the meal editor. Categories are automatically applied when transferring ingredients to the shopping list, so items appear pre-sorted in their correct category groups (closes #33)

## [0.19.5] - 2026-04-14

### Fixed
- iOS PWA: black gap below bottom navigation in standalone mode - iOS reserves the home indicator area outside the CSS viewport, leaving a visible black strip. A fixed `::after` pseudo-element on `body` now fills this area with the surface color. Also added explicit `background-color` to `body` element.

## [0.19.4] - 2026-04-14

### Fixed
- iOS: persistent "forbidden" (403) errors caused by iOS Safari/PWA not reliably exposing CSRF cookie via `document.cookie`. CSRF token is now returned in the response body of `/auth/login` and `/auth/me` and stored in-memory, bypassing cookie read issues entirely. Cookie is still set as fallback.
- CSRF retry: `/auth/me` refresh now reads the token from the response body instead of relying on the cookie being available. Also handles expired sessions (401) during retry instead of silently failing.

## [0.19.3] - 2026-04-14

### Added
- Docker: multi-architecture image support (linux/amd64 + linux/arm64) - enables self-hosting on Raspberry Pi and other ARM64 devices (closes #44)

## [0.19.2] - 2026-04-14

### Improved
- Accessibility: FAB focus ring now uses a double-ring pattern (inner `--color-bg`, outer `--color-accent`) visible on any background - previously hardcoded `#fff` was invisible on light backgrounds
- Accessibility: added `forced-colors` media query fallback for Windows High Contrast Mode (buttons, cards, modals, active nav items)
- Design tokens: extracted `--color-accent-secondary`, `--content-max-width-narrow`, `--cal-hour-height` - eliminates last hardcoded values in layout, settings, and calendar CSS
- Dark mode: Apple sync logo in settings now uses semantic tokens (`--color-text-primary` / `--color-bg`) instead of fixed neutrals that didn't invert correctly
- Sidebar logo gradient now references `--color-accent-secondary` token instead of hardcoded `#7C5CFC`

## [0.19.1] - 2026-04-14

### Fixed
- iOS PWA: "Forbidden" errors after app resume - CSRF cookie was not renewed on `/auth/me` (the first API call after iOS kills and restarts the standalone webapp). iOS aggressively purges cookies of background webapps, causing CSRF token mismatch on all subsequent POST/PUT/DELETE requests
- CSRF middleware: added try-catch and hex validation to prevent server crash from corrupted token cookies (iOS can mangle cookie values)
- API client: automatic CSRF token refresh and retry on 403 - state-changing requests that fail due to stale CSRF tokens are now transparently retried after renewing the token via `/auth/me`
- Service Worker: added 200ms delay before `controllerchange` reload to prevent blank page on iOS standalone mode (the new SW needs time to complete `clients.claim()` before the page reloads)

## [0.19.0] - 2026-04-14

### Added
- i18n: Japanese (ja) locale - full translation with 567 keys; Hiragana/Katakana/Kanji script
- i18n: Arabic (ar) locale - full translation with 567 keys; RTL-ready text
- i18n: Hindi (hi) locale - full translation with 567 keys; Devanagari script
- i18n: Portuguese (pt) locale - full translation with 567 keys; Brazilian Portuguese
- Budget: AED (UAE Dirham), BRL (Brazilian Real), INR (Indian Rupee), SAR (Saudi Riyal) added to currency list
- Service Worker: new locale files pre-cached in APP_SHELL for offline support (sw v31)

## [0.18.2] - 2026-04-14

### Fixed
- Login failure behind Caddy/nginx reverse proxy in Docker: default `TRUST_PROXY` changed from `'loopback'` to `1` (trust one proxy hop). With `'loopback'`, Express ignored `X-Forwarded-Proto: https` from Caddy (which runs on a Docker bridge IP, not loopback), causing `req.secure = false` and express-session to silently drop the session cookie. The new default of `1` correctly handles any single-proxy setup without requiring manual configuration.
- `docker-compose.yml`: added inline comments explaining reverse proxy vs. direct-access configuration
- `docs/docker-compose.portainer.yml`: added explicit `TRUST_PROXY` variable with default `1`

## [0.18.1] - 2026-04-14

### Added
- Customizable dashboard layout: users can now show/hide individual widgets and reorder them via a settings button in the greeting header
- New "Anpassen" button (settings icon) in the dashboard greeting widget opens a modal with toggle switches and up/down controls for each widget (Tasks, Calendar, Shopping, Meals, Notes, Weather)
- Widget configuration persisted server-side via `dashboard_widgets` preference key in `sync_config` table - survives page reload and applies across all family members
- Reset to default layout button in the customize modal
- New i18n keys for all 10 supported locales: `dashboard.customize`, `dashboard.customizeTitle`, `dashboard.customizeReset`, `dashboard.customizeSaved`, `dashboard.weather`, `dashboard.customizeMoveUp`, `dashboard.customizeMoveDown`
- Backend: `GET /api/v1/preferences` now includes `dashboard_widgets` in the response; `PUT /api/v1/preferences` accepts `dashboard_widgets` array with validation and normalization

## [0.18.0] - 2026-04-14

### Added
- Glass Phase 4: Liquid Glass Vibrancy + Tint - deeper glass penetration across all UI surfaces
- New glass tokens in `tokens.css`: `--glass-bg-card` (52% opacity), `--glass-bg-card-hover`, `--glass-bg-input`, `--glass-bg-toolbar`, `--glass-tint-strength` (6% light / 8% dark) with full dark mode and accessibility overrides
- Dashboard widgets now use semi-transparent glass backgrounds with `backdrop-filter: blur(8px) saturate(180%)` - content beneath widgets shines through
- Module tint: each widget gets a subtle accent color gradient overlay via `::after` pseudo-element using `color-mix(module-accent, 6%, transparent)` - dashboard cards carry a hint of their module's color
- Task cards, note items, and meal slots use glass backgrounds with blur for consistent vibrancy
- Page toolbars (Tasks, Notes, Contacts, Calendar) rendered as glass bars with module accent tint
- Form inputs, group toggles, and FAB speed-dial actions use glass vibrancy backgrounds
- App content background uses a radial gradient with the active module accent for ambient vibrancy
- Skeleton loading states use glass backgrounds for visual consistency
- All new glass effects gated behind `@supports (backdrop-filter)` for progressive enhancement
- Accessibility: all new effects respect `prefers-reduced-transparency` (solid fallbacks) and `prefers-reduced-motion`
- Load-order safety: all glass selectors use parent-scoped specificity (`.dashboard .widget`, `.tasks-page .task-card`) to prevent override by on-demand page CSS

## [0.17.4] - 2026-04-13

### Fixed
- iOS PWA: bottom navigation no longer shifts upward in standalone mode - root cause was `body` having `min-height: 100dvh` and no `overflow: hidden`, which allowed the body to scroll; in iOS WebKit standalone mode, body scroll moves `position: fixed` elements rather than keeping them pinned; fix: `html` and `body` are now `overflow: hidden` with fixed height so all scrolling is confined to `.app-content`
- Service worker: cache bumped to `shell-v30` to ensure iOS devices receive the updated `reset.css`

## [0.17.3] - 2026-04-13

### Fixed
- CSS: `glass.css` now works on Safari < 18 - all `@supports` checks extended to `(backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))` so older Safari (which only understands the `-webkit-` prefix) no longer skips the entire block
- CSS: non-blur glass styles (background-color, border, box-shadow) moved outside `@supports` blocks - they are now always active on all browsers and devices, regardless of `backdrop-filter` support

## [0.17.2] - 2026-04-13

### Fixed
- Auth: session cookie and CSRF cookie changed from `SameSite=Strict` to `SameSite=Lax` - Safari's ITP (Intelligent Tracking Prevention) was blocking `Strict` cookies on certain navigations (direct URL entry, reverse proxy), causing a 401 on login while other browsers worked fine (#46)

## [0.17.1] - 2026-04-13

### Fixed
- Service worker: `glass.css` was missing from the shell cache list - on already-installed PWA instances the file was never loaded and no glass effects were visible; cache bumped to `shell-v29`
- CSS load order: `.widget` glass shadow and border were overridden by `dashboard.css` (module CSS loads after `glass.css`); glass styles moved directly into `dashboard.css`
- CSS load order: `.filter-chip--active` glass state was overridden by `tasks.css`; `@supports backdrop-filter` block moved into `tasks.css`
- CSS load order: `.priority-badge` border-radius was reset to `var(--radius-xs)` by `tasks.css`, losing the capsule shape; corrected to `var(--radius-glass-chip)` in `tasks.css`
- `glass.css`: removed dead `.sticky-header` rule (class is not used anywhere in the HTML)

## [0.17.0] - 2026-04-13

### Added
- Design system: `public/styles/glass.css` - new additive layer (~430 lines) implementing Liquid Glass aesthetics: translucent surfaces, `backdrop-filter` blur, capsule shapes, specular highlights, and spring-based motion; loaded globally after `layout.css`, all blur effects gated behind `@supports (backdrop-filter: blur(1px))`
- Design system: Section 16 "Glass Tokens" added to `tokens.css` - ~50 new custom properties covering `--glass-bg*`, `--glass-border*`, `--blur-xs/sm/md/lg/xl`, `--opacity-glass-*`, `--glass-highlight*`, `--glass-shadow-sm/md/lg`, `--radius-glass-card/inner/chip/button`, `--ease-glass`, `--transition-glass`; full dark mode overrides in both `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` blocks
- Navigation: bottom bar now auto-hides on scroll-down (mobile only, < 1024px), reappears on scroll-up with 4 px hysteresis; implemented via `initNavHideOnScroll()` in `router.js` and `.nav-bottom--hidden` CSS class in `glass.css`; `will-change: transform` on `.nav-bottom` for smooth GPU-composited animation
- Animations: modal entrance uses spring easing (`glass-modal-scale-in` + `glass-sheet-in` keyframes) instead of linear fade; page transitions use spring-eased translate instead of plain ease-out; list items stagger with spring `cubic-bezier(0.34, 1.56, 0.64, 1)` spring curve
- Accessibility: `prefers-reduced-transparency`, `prefers-reduced-motion`, and `prefers-contrast: more` media query blocks in both `tokens.css` and `glass.css` - glass effects deactivate and solid fallbacks activate automatically

### Changed
- Glass input styles: `.contacts-toolbar__search-input`, `.notes-toolbar__search-input`, and `.quick-add__input` now use `--radius-glass-button`, `--glass-border-subtle`, and a `color-mix` focus ring for visual consistency with the glass layer (applied directly in module CSS files to respect CSS load order)
- Bottom nav / sidebar: glass blur surface, subtle top highlight, elevated shadow via `glass.css`
- Modal: glass overlay, spring entrance, capsule close button, specular FAB ring pulse (`fab-ring-pulse` keyframe)
- Buttons / FAB: capsule shape via `--radius-glass-button`, specular inner highlight on primary buttons, glass hover glow on secondary
- Skeleton loading: upgraded shimmer gradient uses glass highlight colors
- Focus rings: animated expand-contract ring via `glass-focus-ring` keyframe, applied to interactive glass elements
- PWA viewport: `maximum-scale` changed from `1` to `5` (WCAG 1.4.4 - Resize Text, users can pinch-zoom again)
- Theme color meta tag: `#007AFF` → `#2563EB` (light) and `#1C1C1E` → `#222220` (dark) to match updated token palette

### Fixed
- Accessibility: `--color-text-tertiary` corrected from `#737370` to `#6B6B68` (passes WCAG AA 4.5:1 on `--color-bg`)
- Accessibility: `--color-info` corrected from `#54AEFF` to `#0969DA` (passes WCAG AA 4.5:1 on white)
- Accessibility: modal overlay now carries `aria-label` and `role="presentation"` for correct screen-reader semantics
- Settings: fixed three stale token references (`--color-background` → `--color-bg`, `--duration-fast` → `--transition-fast`, `--color-surface-raised` → `--color-surface-2`)
- Notes: fixed stale token reference `--color-text` → `--color-text-primary` in search input border
- Dashboard: weather widget gradient now uses `var(--color-accent-deep)` instead of hardcoded `#1E5CB3`
- Meals: badge padding now uses spacing tokens (`var(--space-0h) var(--space-2)`) instead of hardcoded `2px 8px`

## [0.16.3] - 2026-04-13

### Added
- i18n: five new UI languages - French (fr), Turkish (tr), Russian (ru), Greek (el), and Chinese Simplified (zh) with full translations of all keys
- Budget: TRY (Turkish Lira) and RUB (Russian Ruble) added to the list of selectable currencies in Settings
- i18n: Italian locale now includes the complete `rrule` section (was missing previously)

## [0.16.2] - 2026-04-13

### Added
- Budget: CNY (Chinese Yuan) added to the list of selectable currencies in Settings (#42)

## [0.16.1] - 2026-04-13

### Fixed
- i18n: fallback language for unsupported browser locales changed from German to English (#43)
- Apple CalDAV sync: calendar events with a `TZID` parameter are now correctly converted to UTC instead of being treated as floating local time, fixing wrong start times for events synced from iOS Calendar (#43)

## [0.16.0] - 2026-04-06

### Added
- Settings: categorized tab navigation - six tabs (General, Meals, Budget, Shopping, Calendar, Account) replace the flat scrolling layout (#30)
- Settings: active tab persists across page navigations via sessionStorage
- Settings: Calendar tab is automatically activated when returning from a Google/Apple OAuth callback
- Settings: tab bar is sticky so it stays visible while scrolling through tab content
- Settings: all tab labels fully translated in de, en, es, it, sv

## [0.15.0] - 2026-04-06

### Changed
- Modal: two-column form layouts now use reusable `.modal-grid` and `.modal-grid--2` CSS classes instead of inline `style` attributes - applied across Calendar, Meals, and Tasks modals (#38)
- Modal: panel on mobile now has a subtle border and large shadow for better depth and visual separation (#38)
- Modal: form groups inside grid layouts no longer need inline `margin-bottom:0` overrides - handled by `.modal-grid > .form-group` rule (#38)

## [0.14.4] - 2026-04-06

### Fixed
- PWA iOS: pinch-to-zoom disabled - added `user-scalable=no, maximum-scale=1` to viewport meta tag for native-app feel (#16)
- PWA iOS: residual body scroll fully blocked - added `overflow: hidden` to `html, body` so any minimal content overflow can no longer make the page body scrollable (#16)
- Service worker cache bumped to v28/v27 (#16)

## [0.14.3] - 2026-04-06

### Fixed
- PWA iOS: scroll bleed fully resolved - `padding-top: env(safe-area-inset-top)` moved from `body` to `.app-shell`; body-padding was pushing `.app-shell` (height: 100dvh) beyond the viewport bottom, allowing the page body itself to scroll (#16)
- PWA iOS: all fixed-height page containers (Calendar, Shopping, Meals, Notes, Budget, Contacts) now subtract `--safe-area-inset-top` from their height calculation so they no longer overflow `.app-content` in standalone mode (#16)
- Added `--safe-area-inset-top` CSS token (mirrors `env(safe-area-inset-top, 0px)`) for consistent use across all page layout calculations (#16)
- Service worker cache bumped to v27/v26 to ensure CSS changes are picked up on next update (#16)

## [0.14.2] - 2026-04-06

### Fixed
- Modal: overlay tap now reliably closes the modal on iOS Safari / PWA - added `cursor: pointer` to the overlay (iOS requires this on non-interactive elements to fire click events) and a `touchend` fallback (#29)
- Modal: close button enlarged from 32px to 40px to meet Apple's 44px touch-target recommendation (#29)
- Modal: swipe-to-close no longer triggers when scrolling content inside the sheet - drag only activates from the top handle zone or when the panel is scrolled to the top (#29)

## [0.14.1] - 2026-04-06

### Fixed
- Calendar: toolbar no longer overflows on narrow screens (< 580px) - view buttons (Monat/Woche/Tag/Agenda) now wrap to a second row so navigation and label remain fully visible (#31)
- Tasks: page title no longer visually overlaps action buttons on narrow screens - title now truncates with ellipsis when space is constrained (#31)
- Shopping: list name no longer overlaps action buttons when the name is long or the "clear checked" button is visible - name now truncates cleanly (#31)

## [0.14.0] - 2026-04-05

### Added
- Spanish (Español) translation - all sections fully translated (tasks, calendar, meals, shopping, budget, notes, contacts, settings) (#28)

## [0.13.0] - 2026-04-05

### Added
- Meals: optional recipe link per meal - add a URL in the meal modal and a link icon appears on the card for one-tap access to the recipe (#18)
- Meals: `recipe_url` field stored in the database (migration v6)

## [0.12.0] - 2026-04-05

### Added
- Shopping: custom categories - add, rename, delete and reorder shopping list categories in Settings → Shopping (#26)
- Shopping: categories are now stored in the database (`shopping_categories` table, migration v5) and fully customizable per household
- Shopping: category order in the shopping list reflects the custom sort order from Settings
- Shopping: items belonging to a deleted category are automatically moved to the next available category

## [0.11.9] - 2026-04-05

### Changed
- README: updated highlights to mention Kanban quick-status buttons and configurable budget currency; replaced docker badge with GHCR link
- docs/installation.md: restructured setup into Option A (pre-built GHCR image, no clone needed) and Option B (build from source); updated Updates section accordingly; added tip to SQLCipher troubleshooting entry
- docs/index.html (GitHub Pages): updated Get Started code block to show pre-built image path; updated task and budget feature descriptions (EN + DE) to reflect new features

## [0.11.8] - 2026-04-05

### Changed
- `docker-compose.yml` now references the pre-built GHCR image (`ghcr.io/ulsklyc/oikos:latest`) by default - no local build needed to get started (#25)
- README Quick Start now shows both the pre-built image path (no clone required) and the build-from-source path

## [0.11.7] - 2026-04-05

### Added
- Kanban view: quick-status button on each card to advance status without drag-and-drop (open → in progress → done → open) - useful for touch devices and kiosk browsers (#24)

## [0.11.6] - 2026-04-05

### Fixed
- Swedish translation: added missing rrule keys (recurrence frequency, weekday abbreviations, unit labels) - contributed by @olsson82 (#23)

## [0.11.5] - 2026-04-05

### Fixed
- Shopping list category dropdown now shows translated labels instead of hardcoded German strings (#21)
- Recurrence fields in task and calendar modals now fully translated (labels, frequency options, weekday abbreviations, unit labels) (#21)

## [0.11.3] - 2026-04-05

### Added
- Swedish (Svenska) translation - contributed by @olsson82 (#19)
- Italian (Italiano) is now explicitly listed as a language option in Settings

## [0.11.2] - 2026-04-05

### Added
- Configurable currency for the budget section: choose from 13 currencies (EUR, USD, GBP, SEK, NOK, DKK, CHF, PLN, CZK, HUF, JPY, AUD, CAD) in Settings → Budget (#20)
- Currency preference is stored household-wide via the preferences API and applied to all budget amounts and formatting

## [0.11.1] - 2026-04-05

### Fixed
- Fix dashboard meal widget ignoring meal type visibility settings - todayMeals query now reads visible_meal_types from sync_config and filters accordingly, consistent with the Meals page (#14)

## [0.11.0] - 2026-04-05

### Added
- Microinteraction improvements: subtle entrance animations, hover/active feedback, and transition polish across cards, buttons, FABs, and nav items

### Fixed
- Fix touch scroll on dashboard and all pages - use `height` instead of `min-height` on app-shell to prevent overflow blocking touch scroll on iOS/Android
- Add `inputmode` and `autocomplete` attributes to form inputs for better mobile keyboard and autofill UX
- Resolve design system audit violations: align spacing, color, border-radius, and shadow usage to tokens throughout all pages and components
- Fix touch scrolling regression in calendar, budget, and contacts introduced by layout refactor

## [0.10.0] - 2026-04-04

### Added
- Customizable meal type visibility: toggle breakfast, lunch, dinner, snack on/off in Settings (#14)
- New household-wide preferences API (`GET/PUT /api/v1/preferences`) using existing `sync_config` table
- New "Meal Plan" section in Settings page with checkbox toggles per meal type
- Meals page filters displayed slots based on household preference
- i18n keys for meal visibility settings in DE, EN, IT

## [0.9.1] - 2026-04-04

### Added
- Persist task view mode (list/kanban) across sessions via localStorage (#17)
- Support URL parameter `?view=kanban` to open tasks directly in Kanban view - ideal for tablet kiosk setups
- View toggle button reflects the persisted/URL-driven view on page load

## [0.9.0] - 2026-04-04

### Added
- Optional task priority: new "None" level allows tasks without urgency, reducing visual noise for routine tasks (#15)
- "None" is now the default priority for new tasks
- Tasks with no priority hide the priority badge entirely in list and dashboard views
- DB migration v4 extends priority CHECK constraint to include 'none'
- i18n keys for "None" priority in de, en, it locales

## [0.8.2] - 2026-04-04

### Fixed
- Fix UI overlap and scroll bleed on iOS PWA - remove double safe-area padding from body that caused content to shift under status bar (#16)
- Fix page containers using wrong nav height token (56px instead of 68px including dot indicator), causing content to render behind bottom nav on all pages
- Add `overflow: hidden` to all fixed-height page containers (shopping, meals, notes, budget, contacts) to prevent scroll bleed
- Add `overscroll-behavior-y: contain` to app-content to prevent rubber-banding scroll propagation
- Fix FAB position on all pages to account for full bottom nav height including dot indicator
- Bump service worker cache version to v23

## [0.8.1] - 2026-04-04

### Fixed
- Replace native `prompt()` dialogs with custom modals in shopping (create/rename list), tasks (add subtask), and meals (choose shopping list) - native prompts were unreliable on mobile/PWA, requiring multiple clicks to close (#12)

## [0.8.0] - 2026-04-04

### Added
- Shopping list widget on dashboard - shows lists with open items, progress bar, and item preview (discussion #9)

## [0.7.7] - 2026-04-04

### Fixed
- Fix modal not closing on mobile when tapping Cancel or Save - add fallback timer for cases where CSS animationend event does not fire (prefers-reduced-motion, tab switch, etc.)

## [0.7.6] - 2026-04-04

### Fixed
- Fix untranslated category names in tasks (group headers), budget (bar chart labels, transaction meta) - all displayed category strings now go through i18n mapping (#11)

## [0.7.5] - 2026-04-04

### Fixed
- Fix flash of unstyled content (FOUC) during page transitions - old module stylesheet is now kept until old content is removed from DOM, new content hidden until render completes
- Smooth nav-item tap transition (0.12s ease) instead of abrupt scale snap
- Add `:focus-visible` outline to interactive cards, buttons, FABs, and toggles for keyboard navigation

### Added
- Custom iOS-style toggle switch component (`.toggle`) replacing native checkboxes in calendar, notes, and budget modals
- Toast notification icons - SVG checkmark (success), alert circle (danger), warning triangle (warning) alongside color coding
- Empty-state fade-in animation (0.4s ease-out, respects `prefers-reduced-motion`)
- Swipe haptic feedback at threshold - `vibrate(15)` fires when swipe reaches 80px during touchmove in tasks and shopping
- Interface design system documentation (`.interface-design/system.md`)

## [0.7.4] - 2026-04-04

### Fixed
- Replace hardcoded `box-shadow` values in `.btn--primary` with `--shadow-sm` / `--shadow-md` tokens
- Replace `border-radius: 50%` with `var(--radius-full)` in layout and calendar styles
- Align ~25 off-grid spacing values (5px, 6px, 7px, 14px, 15px, 22px, 26px, 34px) to 4px grid using `--space-*` tokens

### Changed
- Extract 8 hardcoded `rgba()` colors from dashboard, shopping, and weather styles into new design tokens (`--color-glass`, `--color-glass-hover`, `--color-glass-border`, `--color-danger-translucent`)

## [0.7.3] - 2026-04-04

### Accessibility
- Increase font-size to 16px (`--text-md`) on mobile for `quick-add__input`, `quick-add__qty`, `quick-add__cat` (shopping), `notes-toolbar__search-input`, and `contacts-toolbar__search-input` - prevents iOS auto-zoom on input focus (WCAG touch-friendly inputs)

### Performance
- Lazy-load page-specific stylesheets on route change instead of loading all 10 upfront in `index.html` - reduces initial CSS payload; only tokens, reset, pwa, layout, and login styles are render-blocking

## [0.7.2] - 2026-04-04

### Accessibility
- Rename `#page-content` to `#main-content` so the existing skip-to-content link targets the semantic `<main>` landmark correctly
- Add `sr-only` priority labels to dashboard task items - screen readers now announce priority level instead of relying on color alone (WCAG 1.4.1)

### Fixed
- Replace hardcoded hex values in greeting widget gradient with `--color-accent-active` / `--color-accent` tokens - dark mode now correctly themes the greeting banner
- Replace hardcoded `gap: 2px` with `--space-0h` token in greeting widget

## [0.7.1] - 2026-04-04

### Security
- Fix stored XSS across all pages - extract shared `esc()` utility (`public/utils/html.js`) and apply HTML escaping to all user-controlled data in innerHTML templates (titles, names, locations, descriptions, colors, notes content, autocomplete suggestions)
- Remove `user-scalable=no` and `maximum-scale=1` from viewport meta tag - restores pinch-to-zoom accessibility (WCAG 1.4.4)

### Changed
- Deduplicate 8 identical `escHtml()` functions (tasks, shopping, calendar, notes, meals, contacts, budget, settings) into single shared `esc()` import from `utils/html.js`
- Shared `esc()` also escapes single quotes (`'` to `&#39;`) for safer attribute contexts

## [0.7.0] - 2026-04-04

### Security
- Upgrade bcrypt from 5.1.1 to 6.0.0 - resolves 4 HIGH path traversal CVEs in transitive `tar` dependency via `@mapbox/node-pre-gyp`
- Remove hardcoded fallback session secret - server now always throws if `SESSION_SECRET` is unset, regardless of `NODE_ENV`

### Changed
- **Breaking:** Migrate entire server and test suite from CommonJS to ESM - all `require()`/`module.exports` replaced with `import`/`export`; `"type": "module"` added to `package.json`
- Replace 40+ unstructured `console.*` calls with `server/logger.js` - thin wrapper supporting `LOG_LEVEL` env var (debug/info/warn/error), zero new dependencies
- Translate `package.json` description to English for consistency with all other documentation
- Translate `.env.example` comments from German to English for international contributors
- Translate `.gitignore` comments to English

### Removed
- Remove internal audit documents (`docs/claude-md-audit.md`, `docs/repo-audit-2026-04-02.md`) from tracked files
- Remove empty `.worktrees/` leftover directory

### Added
- Add `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
- Add `.gitignore` patterns for audit report files (`docs/audit-report-*.md`, `docs/*-audit.md`)

## [0.6.0] - 2026-04-03

### Fixed
- Fix budget entry update failing with "Internal Error" when changing category - `date` validator import shadowed the `date` field from the request body, causing SQLite to receive a function reference instead of a string value (fixes #8)

## [0.5.9] - 2026-04-03

### Security
- Fix stored XSS in task titles and subtask titles - all user-provided text in tasks.js is now escaped via `escHtml()` before insertion into innerHTML templates
- Fix stored XSS in settings page member list - display_name and username are now escaped via `escHtml()` in `memberHtml()`
- Fix rate limiter bypass via X-Forwarded-For IP spoofing - `trust proxy` now defaults to `loopback` instead of unconditional `1`; configurable via `TRUST_PROXY` env var
- Fix Google OAuth CSRF - add cryptographic `state` parameter to OAuth flow, validated on callback
- Fix CSV injection in budget export - fields starting with `=`, `+`, `-`, `@`, tab, or carriage return are now prefixed with apostrophe
- Fix missing session invalidation on user deletion - all active sessions of deleted users are now destroyed
- Restrict username to `[a-zA-Z0-9._-]` with minimum 3 characters, preventing HTML/script injection via usernames
- Restrict Google Calendar sync trigger (`POST /google/sync`) and Apple Calendar sync trigger (`POST /apple/sync`) to admin role
- Add warning log when Apple CalDAV credentials are stored without DB encryption enabled

## [0.5.8] - 2026-04-03

### Added
- Add Italian (Italiano) localization - full translation of all 497 i18n keys (thanks @albanobattistella, PR #7)
- Add Italian as selectable language in Settings locale picker

## [0.5.7] - 2026-04-03

### Fixed
- Fix recurring calendar events not expanding - RRULE parser now strips the `RRULE:` prefix used by ICS/CalDAV, which previously caused all recurrence rules to be silently ignored
- Fix recurring multi-day events not appearing when their start date falls before the view window but the event spans into it
- Fix all-day recurring event instances getting datetime end values instead of date-only format
- Add YEARLY recurrence frequency support for birthday and anniversary events

## [0.5.6] - 2026-04-03

### Fixed
- Fix all-day calendar events appearing on the correct day and the following day - ICS DTEND for DATE values is exclusive per RFC 5545, now correctly adjusted (fixes #5)
- Fix multi-day events not showing when using DURATION instead of DTEND - add ICS DURATION property support in CalDAV parser
- Fix birthdays from Apple Calendar not syncing - birthday calendars are no longer excluded from sync
- Fix outbound ICS builder using inclusive DTEND for all-day events - now correctly emits exclusive DTEND per RFC 5545

## [0.5.5] - 2026-04-03

### Fixed
- Fix iCloud Calendar sync failing with FOREIGN KEY constraint error - `created_by` was hardcoded to user ID 1 instead of resolving dynamically (fixes #4)
- Sync all iCloud calendars instead of only the first one - previously only a single calendar was imported, ignoring Family, subscribed, and other calendars
- Add missing `cfgDel` helper function used by `clearCredentials` - disconnecting Apple Calendar would crash
- Skip unreachable or broken calendars gracefully instead of aborting the entire sync

## [0.5.4] - 2026-04-03

### Fixed
- Fix SQLCipher PRAGMA key syntax error on fresh install - hex-encoded key must be wrapped in double quotes for valid PRAGMA syntax (fixes #3)

## [0.5.3] - 2026-04-03

### Security
- Fix SQLCipher PRAGMA key interpolation - encryption keys containing single quotes no longer crash on startup; key is now hex-encoded
- Enforce minimum password length (8 characters) when admin creates new users - previously any 1-character password was accepted
- Add length bounds on username (64 chars) and display_name (128 chars) to prevent unbounded input
- Add input length bounds on login (username 64 chars, password 1024 chars)
- Invalidate all other sessions when a user changes their password - previously active sessions survived password reset
- Session and CSRF cookies now have `secure: true` by default; HTTP is only allowed when `SESSION_SECURE=false` is explicitly set in `.env` - previously cookies were sent without `Secure` flag in non-production environments
- Document authorization model in SECURITY.md - clarify that all family members share read/write access to all data by design

### Changed
- Use multi-stage Docker build to exclude build tools (python3, make, g++) from runtime image
- Exclude `docs/` directory from Docker image via `.dockerignore`
- Consolidate `dotenv.config()` to single call in `server/index.js` - remove duplicate calls from `server/db.js` and `server/auth.js`

## [0.5.2] - 2026-04-01

### Security
- Add rate limiting to SPA fallback route to prevent file system hammering via unauthenticated wildcard requests
- Add CSRF protection to auth routes that change state (logout, create user, change password, delete user) - previously bypassed global CSRF middleware due to router registration order
- Fix incomplete vCard escaping in contacts export - backslash characters are now escaped first before other special characters (`,`, `;`, newline), preventing injection via contact fields
- Restrict CI workflow GITHUB_TOKEN to `contents: read` (principle of least privilege)

## [0.5.1] - 2026-04-01

### Fixed
- Meals: fixed crash when dragging a meal slot - `dragging` state is now destructured before `cleanup()` runs, preventing a null-reference error on drop
- i18n: `t()` now resolves dot-notation keys against nested locale JSON objects (e.g. `t('nav.tasks')` correctly returns `"Aufgaben"` instead of the raw key string); affects all pages, components, and navigation
- PWA: replaced placeholder "O" icons with the actual Oikos house logo across all icon variants (192, 512, maskable 192, maskable 512, apple-touch-icon, favicon); maskable variants use full-bleed background with logo within the 80% safe zone - fixes Android home screen showing only a blue circle
- PWA: weather widget icons (OpenWeatherMap) now render correctly in installed PWA on Android; service worker no longer intercepts cross-origin image requests (opaque responses caused silent rendering failures in standalone mode)
- Settings: language selector replaced from cramped radio buttons to a native `<select>` dropdown using the standard `form-input` style

### Changed
- PWA manifest: added `id` field and `display_override` array for reliable Chrome Android PWA recognition; `manifest.json` is now served with `Content-Type: application/manifest+json`
- Service worker (v22): `/i18n.js` and locale files added to app-shell cache; cross-origin asset requests excluded from cache-first strategy

## [0.5.0] - 2026-03-31

### Added
- i18n: full internationalisation system (`public/i18n.js`) with German (de) and English (en) support; language auto-detected from `navigator.language`, overridable via Settings
- i18n: all user-facing strings moved to locale files (`public/locales/de.json`, `public/locales/en.json`); 489 translation keys covering all modules
- i18n: locale switch without page reload - all pages, components and navigation re-render via `locale-changed` custom event
- i18n: `oikos-locale-picker` Web Component in Settings - three options: System (follows browser language), Deutsch, English
- i18n: dates and times formatted with `Intl.DateTimeFormat` using the active locale; `formatDate()` and `formatTime()` exported from `i18n.js`
- i18n: fallback chain (active locale → German → key) ensures no untranslated keys are shown even if a future locale file is incomplete
- i18n: adding a new language requires only one JSON file (`public/locales/xx.json`) and one line in `SUPPORTED_LOCALES`

## [0.4.0] - 2026-03-31

### Fixed
- Mobile: toast notifications no longer overlap with the bottom navigation bar - introduced `--nav-bottom-height` token (scroll area 56px + dots indicator 12px) used consistently by toast container and app content padding
- Mobile: FAB and page-FAB are now hidden when the virtual keyboard is open, preventing them from covering form inputs; detection uses `visualViewport.resize` with a 75% height threshold
- UI: added missing dark-mode colour overrides for shopping, notes, contacts, budget, and settings module tokens - accent stripes now render at readable pastel values in dark theme
- UI: meals week-navigation bar now shows module accent top-border stripe; settings page now declares --module-accent for consistency with all other modules

### Added
- Shopping: swipe-left to toggle checked/unchecked, swipe-right to delete items on mobile; × delete button hidden on mobile in favour of swipe gesture
- Notes: client-side full-text search bar in toolbar - filters by title and content instantly; shows "Keine Treffer" empty state when no match
- Dashboard: weather widget refresh button (top-right corner) + automatic 30-minute refresh interval; interval is cleared when navigating away
- Contacts: vCard export button per contact (downloads .vcf file); vCard import via file input in toolbar (parses FN, TEL, EMAIL, ADR, NOTE, CATEGORIES fields)
- PWA: offline fallback page (`/offline.html`) served by service worker when network is unavailable and index.html is not cached; page includes a reload button
- UI: module accent colours now applied to three visual layers - active nav tab (bottom bar + sidebar), toolbar top-border stripe, and list/card left-border stripe - giving each module a distinct colour identity

## [0.3.0] - 2026-03-31

### Added
- Calendar: recurring events are now expanded in GET /api/v1/calendar - all occurrences within the requested date window are returned as virtual instances; duration is preserved; instances are marked with is_recurring_instance=1 and shown with a ↻ icon in the agenda view; /upcoming also expands recurring events within a 90-day window
- Budget: recurring entries auto-generate instances for each viewed month; instances deleted by the user are skipped permanently via `budget_recurrence_skipped` table; generated instances are marked with ↩ in the transaction list
- Budget: month-over-month comparison in summary cards - each card (Einnahmen, Ausgaben, Saldo) shows a trend line (▲/▼ + delta amount vs. previous month); previous month summary is fetched in parallel with current month
- Meals: drag & drop between slots and days using Pointer Events (touch + mouse); ghost element follows pointer; drop on occupied slot swaps meals; reduced-motion: no ghost animation, interaction still works
- Settings: Apple CalDAV credentials form (URL, Apple-ID, app-specific password) with live connection test; admin can connect and disconnect via UI without restarting the server; DB-stored credentials take precedence over .env vars; auto-sync runs every 15 min (configurable via SYNC_INTERVAL_MINUTES)

## [0.2.1] - 2026-03-30

### Fixed
- Accumulating click listeners on `#notes-grid`: listener is now registered once in `render()` via event delegation instead of re-registered in every `renderGrid()` call
- Accumulating anonymous `document` click listener in dashboard FAB: `initFab()` now accepts an AbortSignal; `render()` aborts the previous signal before creating a new one, eliminating listener leaks across navigation cycles
- Add `btnError()` shake feedback to notes.js save error handler for consistency with other modules
- Calendar event popup `closePopup` listener now checks `popup.isConnected` to self-remove correctly after navigation without a click

### Added
- CSS alias `.form-label` alongside `.label` to cover usage in `notes.js` and `settings.js` without requiring a mass-rename
- Tests for `wireBlurValidation`, `btnSuccess`, and `btnError` (12 cases) in `test-modal-utils.js`

## [0.2.0] - 2026-03-30

### Changed
- Directional slide-x page transitions (forward = right, backward = left) with race condition guard
- PWA install prompt delayed until 2 user interactions; dismiss window reduced from 30 to 7 days; interaction counter resets on dismiss
- Unified card padding to 16px (`--space-4`) across tasks, contacts, budget, and meals modules

### Added
- Staggered fade-in animation for list items on page load across all modules (tasks, shopping, meals, contacts, budget, notes, calendar agenda)
- Unified empty states using shared `.empty-state` class across all modules (replaces per-module CSS)
- `stagger()` and `vibrate()` UX utilities in `public/utils/ux.js` with full test coverage
- Proportional opacity on swipe-reveal action areas in tasks (already implemented, confirmed)
- FAB colors tied to per-module accent tokens via CSS custom properties
- `scrollIntoView` for focused inputs when virtual keyboard opens in modals (300ms delay)
- Consistent vibration feedback via `vibrate()` utility across tasks, shopping, contacts, budget, and notes
- Bottom sheet modal on mobile (< 768px) with drag handle, slide-in animation, and swipe-to-close
- Enter-key navigation between form fields in modals; Enter on last field triggers submit
- Blur-triggered inline validation for required fields with error/success border states
- `wireBlurValidation()`, `btnSuccess()`, and `btnError()` exported from `modal.js`
- Submit button checkmark-success (700ms) and shake-error feedback animations

## [0.1.0] - 2026-03-29

Initial release of Oikos - a self-hosted family planner for 2–6 person households. Runs as a Docker container behind Nginx with SSL, no cloud dependency.

### Added

- **Dashboard** with time-of-day greeting, urgent tasks, upcoming events, today's meals, pinned notes, and weather widget (OpenWeatherMap integration with 3–5 day forecast scaling by screen size)
- **Task management** with categories, priorities, due dates, subtasks (max 2 levels), list and Kanban views, swipe gestures on mobile (swipe left = toggle done, swipe right = edit), and recurring tasks via iCal RRULE
- **Shopping lists** with multiple named lists, supermarket-aisle sorting, autocomplete from history, optimistic checkbox toggle, and bulk-clear of checked items
- **Weekly meal planner** with breakfast/lunch/dinner/snack grid (Mon–Sun), ingredient tracking per meal, and one-click transfer of ingredients to shopping lists
- **Calendar** with month, week, day, and agenda views, multi-day event support, color-coded entries, and family member assignment
- **Google Calendar sync** via OAuth 2.0 with incremental sync tokens and **Apple CalDAV sync** via tsdav, both bidirectional
- **Pinboard** (notes) with color-coded sticky notes, pin-to-top, Markdown formatting toolbar (bold, italic, lists, headings, code, links), and automatic text contrast based on background color
- **Contacts** directory with category filtering (doctor, emergency, trades, etc.), full-text search, and direct tel:/mailto:/maps: links
- **Budget tracker** with income/expense logging, monthly navigation, category breakdown bar charts (pure CSS), and CSV export
- **Settings page** for password change, calendar sync status, and family member management
- **Authentication** with session-based login (bcrypt, httpOnly/secure/sameSite cookies, 7-day TTL), admin-only user creation, and rate-limited login (5 attempts/min with 15-min lockout)
- **CSRF protection** using Double Submit Cookie pattern with timing-safe comparison
- **Progressive Web App** with app-shell caching (service worker with stale-while-revalidate for static assets, network-first for navigation, network-only for API), custom install prompt for Android and iOS, dynamic theme-color per module, safe area inset handling, and offline fallback
- **Responsive design** with mobile bottom navigation (swipeable pages with dot indicator), collapsible sidebar on tablet, and full sidebar on desktop
- **Dark mode** with system preference detection and manual toggle, warm-tinted neutral color scale
- **Design system** with CSS custom properties (tokens for colors, spacing, typography, shadows, radii, z-indices), module-specific accent colors, and consistent component patterns
- **Accessibility** improvements: skip link, sr-only headings on all pages, aria-hidden decorative icons, aria-label on icon-only buttons, token-based touch targets (44–48px), 12px minimum font size, and prefers-reduced-motion support
- **Docker deployment** with docker-compose, optional SQLCipher encryption (AES-256), and nginx.conf example
- **Setup script** (`node setup.js`) for initial admin account creation with LAN-reachable URL display
- **Input validation** middleware with centralized rules (string length, date/time format, enum, color) across all API routes
- **Content Security Policy** via Helmet with strict CSP, self-hosted Lucide Icons (no CDN at runtime)
- **Lazy loading** with per-page ES module imports cached in memory, Cache-Control headers (immutable for assets, must-revalidate for code), and service worker update notification

### Security

- Fail-fast on missing `SESSION_SECRET` in production
- Rate limiting on login endpoint and global API limiter (300 req/min/IP)
- No user data cached by service worker (API requests are network-only)
- Hardened `.gitignore` and `.dockerignore` to prevent accidental secret or binary leakage

[Unreleased]: https://github.com/ulsklyc/oikos/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/ulsklyc/oikos/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/ulsklyc/oikos/compare/v0.5.9...v0.6.0
[0.5.9]: https://github.com/ulsklyc/oikos/compare/v0.5.8...v0.5.9
[0.5.8]: https://github.com/ulsklyc/oikos/compare/v0.5.7...v0.5.8
[0.5.7]: https://github.com/ulsklyc/oikos/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/ulsklyc/oikos/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/ulsklyc/oikos/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/ulsklyc/oikos/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/ulsklyc/oikos/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/ulsklyc/oikos/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/ulsklyc/oikos/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/ulsklyc/oikos/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ulsklyc/oikos/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ulsklyc/oikos/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/ulsklyc/oikos/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ulsklyc/oikos/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ulsklyc/oikos/releases/tag/v0.1.0
