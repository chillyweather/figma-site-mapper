# 🏗️ Architecture Diagram

## Component Tree

```
App (Jotai Provider)
│
├── currentView === 'settings'
│   └── SettingsView
│       ├── Screenshot Settings Section
│       │   ├── FocusedInput (width)
│       │   └── Select (scale factor)
│       │
│       ├── Crawl Performance Section
│       │   ├── FocusedInput (delay)
│       │   └── FocusedInput (request delay)
│       │
│       ├── Crawl Limits Section
│       │   ├── FocusedInput (max requests)
│       │   ├── FocusedInput (max depth)
│       │   ├── FocusedInput (sample size)
│       │   └── Checkboxes (various options)
│       │
│       └── Authentication Section
│           ├── Select (auth method)
│           ├── FocusedInput (login URL)
│           ├── FocusedInput (username)
│           ├── FocusedInput (password)
│           └── FocusedTextarea (cookies)
│
└── currentView === 'main'
    └── MainView
        ├── Header
        │   ├── Title
        │   └── Settings Button
        │
        ├── Tab Navigation
        │   ├── Crawling Tab Button
        │   └── Flows Tab Button
        │
        ├── activeTab === 'crawling'
        │   └── CrawlingTab
        │       ├── FocusedInput (URL)
        │       ├── Start Crawl Button
        │       ├── Status Display
        │       └── Close Button
        │
        └── activeTab === 'mapping'
            └── MappingTab
                ├── Badge Links List
                │   └── Link Items (with checkboxes)
                └── Show Flow Button
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Jotai Store                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  settingsAtom                                     │  │
│  │  currentViewAtom                                  │  │
│  │  isLoadingAtom                                    │  │
│  │  statusAtom                                       │  │
│  │  jobIdAtom                                        │  │
│  │  authStatusAtom                                   │  │
│  │  badgeLinksAtom                                   │  │
│  │  checkedLinksAtom                                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                    Custom Hooks                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  useSettings()                                   │  │
│  │    ├── Load settings from clientStorage          │  │
│  │    ├── Save settings with debounce               │  │
│  │    └── Update individual settings                │  │
│  │                                                  │  │
│  │  useCrawl()                                      │  │
│  │    ├── Start crawl                               │  │
│  │    ├── Poll for status                           │  │
│  │    └── Handle completion                         │  │
│  │                                                  │  │
│  │  useFlowMapping()                                │  │
│  │    ├── Track badge links                         │  │
│  │    ├── Handle link selection                     │  │
│  │    └── Show flow visualizatio                    │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Components                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │  App                                              │  │
│  │    ├── Uses all hooks                             │  │
│  │    ├── Orchestrates state                         │  │
│  │    └── Renders views                              │  │
│  │                                                    │  │
│  │  MainView / SettingsView                          │  │
│  │    ├── Receive props from App                     │  │
│  │    ├── Render UI elements                         │  │
│  │    └── Call handlers                              │  │
│  │                                                    │  │
│  │  CrawlingTab / MappingTab                         │  │
│  │    ├── Focused UI sections                        │  │
│  │    └── Reuse common components                    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 Plugin Communication                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  parent.postMessage()                             │  │
│  │    ├── start-crawl                                │  │
│  │    ├── save-settings                              │  │
│  │    ├── load-settings                              │  │
│  │    ├── get-status                                 │  │
│  │    ├── show-flow                                  │  │
│  │    └── close                                      │  │
│  │                                                    │  │
│  │  window.addEventListener('message')               │  │
│  │    ├── crawl-started                              │  │
│  │    ├── settings-loaded                            │  │
│  │    ├── status-update                              │  │
│  │    └── badge-links-update                         │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend API                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  POST /crawl                                      │  │
│  │  GET  /status/:jobId                              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Module Dependencies

```
ui.tsx (Entry)
  └── components/App
      ├── hooks/useSettings
      │   ├── store/atoms
      │   └── types/index
      │
      ├── hooks/useCrawl
      │   ├── store/atoms
      │   ├── hooks/useSettings
      │   ├── utils/api
      │   └── utils/validation
      │
      ├── hooks/useFlowMapping
      │   ├── store/atoms
      │   └── types/index
      │
      ├── components/MainView
      │   ├── components/CrawlingTab
      │   │   ├── components/common/FocusedInput
      │   │   └── types/index
      │   │
      │   └── components/MappingTab
      │       └── types/index
      │
      └── components/SettingsView
          ├── components/common/FocusedInput
          ├── components/common/FocusedTextarea
          └── types/index

constants/index
  └── types/index

utils/validation
  └── types/messages

utils/api
  ├── constants/index
  └── types/messages
```

---

## State Flow

### Settings Update Flow

```
1. User types in input
   ↓
2. FocusedInput onChange fires
   ↓
3. App's handleChange (e.g., handleUrlChange)
   ↓
4. useSettings().updateSetting()
   ↓
5. Jotai atom updated
   ↓
6. Debounced save to clientStorage
   ↓
7. Component re-renders with new value
```

### Crawl Flow

```
1. User clicks "Start Crawl"
   ↓
2. CrawlingTab handleSubmit fires
   ↓
3. useCrawl().handleSubmit()
   ↓
4. Validate & parse settings
   ↓
5. Send message to plugin
   ↓
6. Plugin calls backend API
   ↓
7. Receive crawl-started message
   ↓
8. Update jobId atom
   ↓
9. Start polling interval
   ↓
10. Receive status updates
    ↓
11. Update status atom
    ↓
12. UI shows progress
    ↓
13. On completion: stop polling
```

### Flow Mapping

```
1. Plugin scans page for badge links
   ↓
2. Send badge-links-update message
   ↓
3. useFlowMapping receives message
   ↓
4. Update badgeLinksAtom
   ↓
5. MappingTab renders links
   ↓
6. User checks links
   ↓
7. Update checkedLinksAtom
   ↓
8. User clicks "Show Flow"
   ↓
9. Send show-flow message with selected links
   ↓
10. Plugin creates flow visualization
```

---

## File Organization Logic

### By Layer

**Presentation Layer** (`components/`)

- React components
- UI logic only
- No business logic
- Receives props, renders UI

**Business Logic Layer** (`hooks/`)

- Custom hooks
- Encapsulate logic
- Reusable
- Side effects handled

**State Layer** (`store/`)

- Global state atoms
- Jotai configuration
- Pure state

**Data Layer** (`types/`, `constants/`)

- Type definitions
- Constants
- Configuration

**Utility Layer** (`utils/`)

- Pure functions
- Validation
- API calls
- Transformations

---

## Communication Patterns

### Parent ➜ Child (Props)

```typescript
<MainView
  url={settings.url}
  handleUrlChange={handleUrlChange}
  isLoading={isLoading}
  // ... more props
/>
```

### Child ➜ Parent (Callbacks)

```typescript
const handleUrlChange = useCallback(
  (e: ChangeEvent<HTMLInputElement>) => {
    updateSetting("url", e.target.value);
  },
  [updateSetting]
);
```

### Global State (Jotai)

```typescript
// Write
const [settings, setSettings] = useAtom(settingsAtom);
setSettings(newSettings);

// Read
const settings = useAtomValue(settingsAtom);

// Write only
const setSettings = useSetAtom(settingsAtom);
```

### Plugin Communication

```typescript
// Send
parent.postMessage(
  {
    pluginMessage: { type: "start-crawl", data },
  },
  "*"
);

// Receive
useEffect(() => {
  const handler = (event: MessageEvent) => {
    const msg = event.data.pluginMessage;
    if (msg?.type === "crawl-started") {
      // handle
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}, []);
```

---

## Scalability Patterns

### Adding a New Tab

```
1. Create components/MyNewTab.tsx
2. Add tab button in MainView
3. Add tab content rendering
4. Create hook if needed (hooks/useMyFeature.ts)
5. Add types if needed (types/index.ts)
```

### Adding a New Setting

```
1. Add to PluginSettings type (types/index.ts)
2. Add to DEFAULT_SETTINGS (constants/index.ts)
3. Add to SettingsView component
4. Add handler in App component
5. Add validation if needed (utils/validation.ts)
```

### Adding a New Hook

```
1. Create hooks/useMyHook.ts
2. Define state atoms if needed (store/atoms.ts)
3. Implement logic with useAtom
4. Export hook functions
5. Use in App or component
```

---

## Testing Strategy

### Unit Tests

```
hooks/
  ├── useSettings.test.ts
  ├── useCrawl.test.ts
  └── useFlowMapping.test.ts

utils/
  ├── validation.test.ts
  └── api.test.ts

components/
  ├── CrawlingTab.test.tsx
  ├── MappingTab.test.tsx
  └── SettingsView.test.tsx
```

### Integration Tests

```
App.integration.test.tsx
  ├── Full crawl workflow
  ├── Settings persistence
  └── Flow mapping workflow
```

### E2E Tests (Future)

```
e2e/
  ├── crawl.spec.ts
  ├── settings.spec.ts
  └── flows.spec.ts
```

---

## Performance Considerations

### Render Optimization

- ✅ Jotai provides fine-grained updates
- ✅ Only affected components re-render
- ✅ useCallback for event handlers
- ✅ Proper dependency arrays

### Memory Management

- ✅ Clean up intervals in useEffect
- ✅ Clean up event listeners
- ✅ Debounce expensive operations

### Bundle Size

- ✅ Small entry point (8 lines)
- ✅ Jotai is lightweight (3KB)
- ✅ No unnecessary dependencies
- ✅ Tree-shakeable exports

---

## 🎯 Architecture Highlights

1. **Atomic Design** - Small, composable pieces
2. **Unidirectional Data Flow** - Predictable state updates
3. **Separation of Concerns** - Clear boundaries
4. **Dependency Injection** - Props and hooks
5. **Single Responsibility** - One purpose per file
6. **SOLID Principles** - Professional architecture
7. **DRY** - No repetition
8. **Type Safety** - TypeScript throughout

**Result: Senior-level, production-ready architecture!** 🚀
