# Cookie Persistence & Settings Implementation

## Overview

This implementation ensures that:
1. **Settings are respected across all plugin operations** (crawling and flow visualization)
2. **Cookies are captured from initial crawls** and stored per domain
3. **Cached cookies are reused** when creating flow visualizations for the same domain

## How It Works

### 1. Cookie Capture (Backend)

**File**: `packages/backend/src/crawler.ts`

After crawling completes, the system captures all cookies from the browser context and includes them in the manifest:

```typescript
// Captures cookies from browser session
capturedCookies = allCookies.map(cookie => ({
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain,
}));

// Adds to manifest
const manifest = {
  startUrl: canonicalStartUrl,
  crawlDate: new Date().toISOString(),
  tree: siteTree,
  cookies: capturedCookies.length > 0 ? capturedCookies : undefined,
};
```

**What this captures**:
- Session tokens from successful logins
- Authentication cookies from CAPTCHA solutions
- Any other cookies set during the crawl (e.g., preferences, tracking)

### 2. Cookie Storage (Plugin)

**File**: `packages/plugin/src/plugin/handlers/uiMessageHandlers.ts`

When a crawl completes, cookies are extracted from the manifest and stored in Figma's client storage, indexed by domain:

```typescript
await storeDomainCookies(domain, manifestData.cookies);
```

**Storage structure**:
```typescript
{
  "example.com": {
    cookies: [...],
    timestamp: 1697500000000
  },
  "another-site.com": {
    cookies: [...],
    timestamp: 1697600000000
  }
}
```

**Cookie freshness**: Cookies older than 24 hours are ignored to prevent using stale sessions.

### 3. Cookie & Settings Reuse (Flow Visualization)

**File**: `packages/plugin/src/plugin/handlers/flowHandlers.ts`

When creating a flow visualization:

1. **Load user settings** from client storage
   - Includes `showBrowser` preference
   - Respects user's browser visibility choice

2. **Load cached cookies** for the target domain
   - Only if cookies exist and are fresh (<24 hours)
   - Automatically matches domain from URL

3. **Pass to crawler**:
   ```typescript
   const result = await startCrawl({
     url,
     showBrowser: showBrowser,  // From settings
     auth: {
       method: "cookies",
       cookies: domainCookies     // From cache
     }
   });
   ```

## Benefits

### For Users
- ✅ **No re-authentication needed**: Login once, create multiple flows
- ✅ **Consistent browser behavior**: Settings work everywhere
- ✅ **Works with CAPTCHA**: Cookies from solved CAPTCHAs are reused
- ✅ **Automatic cleanup**: Old cookies expire after 24 hours

### For Developers
- ✅ **Domain isolation**: Cookies are stored per domain
- ✅ **Type-safe**: Full TypeScript support
- ✅ **Transparent**: Extensive console logging for debugging
- ✅ **Fallback handling**: Gracefully handles missing cookies

## Usage Examples

### Example 1: Login-Protected Site
```
1. User enables "Show browser" in settings
2. User starts crawl of https://app.example.com
3. Browser opens, user logs in manually
4. Crawl completes, cookies are captured and stored
5. User creates flow → Browser opens again (setting respected)
6. Flow target page uses stored cookies → Already logged in!
```

### Example 2: CAPTCHA-Protected Site
```
1. User crawls https://protected-site.com
2. CAPTCHA appears, user solves it
3. Cookies from solved CAPTCHA are stored
4. Later, user creates flows → No CAPTCHA appears (cookies work!)
```

## Console Output

The implementation provides detailed logging:

```
Backend (Crawler):
🍪 Captured 5 cookies from browser session

Plugin (Storage):
🍪 Stored 5 cookies for domain example.com

Plugin (Flow):
🍪 Found 5 cached cookies for example.com
🍪 Using 5 cached cookies for authentication
```

## Cookie Lifetime Management

- **Fresh**: Cookies < 24 hours old are used
- **Stale**: Cookies > 24 hours old are ignored
- **Manual refresh**: User can trigger new crawl to refresh cookies
- **Domain-specific**: Each domain has its own cookie cache

## Security Considerations

1. **Local storage only**: Cookies stored in Figma's secure client storage
2. **No transmission**: Cookies never leave user's machine (except to backend during crawls)
3. **Automatic expiry**: 24-hour limit prevents long-term exposure
4. **Domain isolation**: Cookies can't leak between domains

## Testing

To verify the implementation:

1. **Test basic flow**:
   ```
   1. Crawl a site with authentication
   2. Create a flow to authenticated page
   3. Check console for cookie logs
   ```

2. **Test setting persistence**:
   ```
   1. Enable "Show browser" in settings
   2. Create a flow → Browser should be visible
   3. Disable setting
   4. Create another flow → Browser should be hidden
   ```

3. **Test cookie expiry**:
   ```
   1. Manually set timestamp to 25 hours ago in storage
   2. Try to create flow → Should ignore stale cookies
   ```

## Future Enhancements

Potential improvements:
- [ ] User-visible cookie management UI
- [ ] Manual cookie refresh button
- [ ] Configurable cookie expiry time
- [ ] Export/import cookie configurations
- [ ] Cookie health check before flows
