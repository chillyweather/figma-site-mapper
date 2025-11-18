# Authorization Flow Enhancement Plan

## Objective
Enable a reliable "Authorize before crawl" experience by surfacing the manual authentication workflow directly inside the Crawling tab, ensuring users can log in or solve CAPTCHA in a dedicated browser session before starting a crawl.

## Current Behavior & Pain Points
- Manual auth is buried inside `Settings → Authentication`, even though the workflow is required immediately before a protected crawl.
- Users misinterpret the "Show browser" option as the place to enter credentials, but that window belongs to the crawler and closes automatically, preventing login.
- The existing manual auth flow already works end-to-end (Playwright browser opens, cookies are stored, subsequent crawl reuses them), but is discoverability-poor and lacks inline status on the crawl screen.

## Guiding Principles
1. **No backend changes:** Reuse the existing `/auth-session` endpoint, `open-auth-session` handler, and cookie storage.
2. **Explicit pre-crawl step:** Give users a one-click CTA in the Crawling tab to launch the auth session.
3. **Share state:** Reuse the existing `authStatus` atom and status messaging between Settings and Crawling tabs so the user always knows whether cookies are available.
4. **Fail fast:** Block the crawl start if the user selects manual auth but cookies are missing, and surface an inline hint to run the Authorize flow first.

## Proposed UX
1. Add an "Authorize" button (primary-style tertiary action) next to the Start Crawl controls. The button is enabled when:
   - A project is selected
   - The URL field has a value
   - No crawl/snapshot is currently running
2. When clicked, it dispatches the existing `open-auth-session` plugin message with the trimmed URL. While the Auth browser is open, the button label changes to "Browser Open – complete login" and disables further clicks.
3. A condensed status pill appears under the button (e.g., `Authenticating…`, `Authentication successful`, `Authentication failed`). Messages reuse `authStatusAtom` so they stay in sync with Settings.
4. Successful completion triggers a toast and (optionally) auto-switches the `authMethod` in settings to `manual`. If switching automatically feels risky, display a banner reminding the user to pick the manual method before starting the crawl.

## Implementation Steps

### 1. Hooks & State (`packages/plugin/src/hooks/useCrawl.ts`)
- Expose a new `handleOpenAuthSession` callback that:
  - Validates `settings.url` and `activeProjectId` similar to `handleSubmit`.
  - Posts `{ type: "open-auth-session", url: settings.url.trim() }`.
  - Optionally sets a local `isAuthBrowserOpen` ref/atom to update button copy instantly before backend responds.
- Include `authStatus` and any new flags in the hook return signature so UI components can bind to them without extra selectors.

### 2. Crawling Tab UI (`packages/plugin/src/components/CrawlingTab.tsx`)
- Import the new handler and `authStatus` via `CrawlingTabProps`.
- Insert the Authorize button between the URL field and Start Crawl button stack:
  - Disabled state mirrors Start Crawl prerequisites (URL + project + idle state).
  - Label reflects `authStatus` (`Authenticating…`, `Authorized`, fallback `Authorize`).
- Add a helper text block under the button:
  - `Authenticating…` (yellow), `Authentication successful` (green), `Authentication failed` (red with retry prompt).
- Optionally show a reminder badge if `authMethod === "manual"` but `authStatus` isn’t `success` yet.

### 3. Settings Synchronization (`packages/plugin/src/components/SettingsView.tsx`)
- Keep the existing manual-auth section for advanced users, but:
  - Reference the new Crawling-tab button (e.g., "You can also start authorization from the Crawling tab").
  - Update helper copy to clarify that the auth session is a prerequisite for protected crawls.
- When `authStatus === "success"`, surface the cookie count (already provided via `auth-session-status`) so both tabs show consistent messaging.

### 4. Message Handlers (`packages/plugin/src/plugin/handlers/uiMessageHandlers.ts`)
- No structural changes needed; ensure logging clearly indicates when cookies are stored for a domain so the new UI states have matching console breadcrumbs.
- (Optional) extend `auth-session-status` payload with a `domain` field so the UI can display "Authorized for example.com".

### 5. Crawl Preconditions
- In `handleStartCrawl`, already logging when manual auth is selected but cookies missing. Augment UI copy near Start Crawl to prompt "Run Authorize first" when this happens.
- Consider storing a timestamp (e.g., `authCookiesUpdatedAt`) in clientStorage to invalidate old cookies automatically (stretch goal).

## Validation Plan
1. **Happy path:**
   - Select project, enter URL, click Authorize, log in, confirm success banner, start crawl, ensure authenticated pages are fetched.
2. **Missing cookies:**
   - Switch to manual without authorizing, attempt to crawl, confirm inline warning + disabled state.
3. **Auth failure:**
   - Close browser without login; verify UI shows failure state and button re-enables for retry.
4. **Fallback to Settings:**
   - Trigger auth from Settings tab to ensure Crawling tab status updates automatically.

## Risks & Mitigations
- **Multiple domains per project:** Cookies are keyed per hostname; remind users they must authorize again if the start URL changes host.
- **User forgets to enable manual auth:** Consider auto-switching or prompting after successful authorization.
- **Playwright window timing out:** Maintain generous timeout (already 60s) and document expectation to close the browser manually when finished.
