# Plugin UI Architecture

## Quick Start

The UI is built with React, TypeScript, and Jotai for state management.

## Project Structure

### 📁 **components/**

React components organized by feature:

- `App.tsx` - Main application orchestrator
- `MainView.tsx` - Main view with tab navigation
- `SettingsView.tsx` - Settings interface
- `CrawlingTab.tsx` - Website crawling interface
- `MappingTab.tsx` - User flow mapping interface
- `common/` - Reusable components

### 📁 **hooks/**

Custom React hooks for business logic:

- `useSettings.ts` - Settings persistence & state
- `useCrawl.ts` - Crawl operations & polling
- `useFlowMapping.ts` - Flow mapping logic

### 📁 **store/**

Jotai atoms for global state:

- `atoms.ts` - All state atoms

### 📁 **types/**

TypeScript definitions:

- `index.ts` - Component props & interfaces
- `messages.ts` - Plugin message types

### 📁 **constants/**

App-wide constants:

- `index.ts` - Settings defaults, URLs, keys

### 📁 **utils/**

Utility functions:

- `validation.ts` - Input parsing & validation
- `api.ts` - Backend API calls

## Adding New Features

### 1. Add a new component

```typescript
// components/MyNewComponent.tsx
import React from 'react';

interface MyNewComponentProps {
  // props
}

export const MyNewComponent: React.FC<MyNewComponentProps> = (props) => {
  return <div>...</div>;
};
```

### 2. Add state (if needed)

```typescript
// store/atoms.ts
export const myNewAtom = atom<MyType>(initialValue);
```

### 3. Add a custom hook

```typescript
// hooks/useMyFeature.ts
import { useAtom } from "jotai";
import { myNewAtom } from "../store/atoms";

export function useMyFeature() {
  const [value, setValue] = useAtom(myNewAtom);
  // logic
  return { value, setValue };
}
```

### 4. Add types

```typescript
// types/index.ts
export interface MyNewType {
  // properties
}
```

## Code Style

### Component Pattern

```typescript
import React from 'react';
import { MyProps } from '../types';

export const MyComponent: React.FC<MyProps> = ({
  prop1,
  prop2
}) => {
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

### Hook Pattern

```typescript
import { useCallback } from "react";
import { useAtom } from "jotai";

export function useMyHook() {
  const [state, setState] = useAtom(myAtom);

  const myFunction = useCallback(() => {
    // logic
  }, [dependencies]);

  return { state, myFunction };
}
```

## State Management

We use **Jotai** for state management:

```typescript
// Define an atom
const countAtom = atom(0);

// Use in a component
const [count, setCount] = useAtom(countAtom);

// Read-only
const count = useAtomValue(countAtom);

// Write-only
const setCount = useSetAtom(countAtom);
```

## Plugin Communication

### Send message to plugin

```typescript
parent.postMessage({
  pluginMessage: {
    type: 'my-message',
    data: {...}
  }
}, '*');
```

### Receive message from plugin

```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    const msg = event.data.pluginMessage;
    if (msg?.type === "my-message") {
      // handle
    }
  };

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, []);
```

## Best Practices

1. ✅ **Keep components small** - Max 200 lines
2. ✅ **One responsibility per file** - Single purpose
3. ✅ **Use TypeScript strictly** - No `any` types
4. ✅ **Extract logic to hooks** - Reusable business logic
5. ✅ **Memoize callbacks** - Use `useCallback` for event handlers
6. ✅ **Type all props** - Define interfaces for all components
7. ✅ **Clean up effects** - Always return cleanup functions
8. ✅ **Validate inputs** - Use validation utilities

## Common Patterns

### Form Input with Auto-save

```typescript
const { updateSetting } = useSettings();

const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  updateSetting('fieldName', e.target.value);
}, [updateSetting]);

<FocusedInput value={settings.fieldName} onChange={handleChange} />
```

### Conditional Rendering

```typescript
{condition && <Component />}
{condition ? <ComponentA /> : <ComponentB />}
```

### List Rendering

```typescript
{items.map((item) => (
  <Item key={item.id} {...item} />
))}
```

## Debugging

### Check Atom Values

```typescript
// In component
console.log("Current value:", useAtomValue(myAtom));
```

### Check Plugin Messages

```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    console.log("Received:", event.data.pluginMessage);
  };
  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, []);
```

### React DevTools

- Install React DevTools browser extension
- Inspect component tree
- View props and state
- Track re-renders

## Performance Tips

1. **Memoize expensive computations**

   ```typescript
   const expensiveValue = useMemo(() => computeExpensive(data), [data]);
   ```

2. **Prevent unnecessary re-renders**

   ```typescript
   const MemoizedComponent = React.memo(MyComponent);
   ```

3. **Use callback refs for cleanup**
   ```typescript
   const ref = useCallback((node) => {
     if (node) {
       // setup
       return () => {
         // cleanup
       };
     }
   }, []);
   ```

## Resources

- [Jotai Documentation](https://jotai.org/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Figma Plugin API](https://www.figma.com/plugin-docs/)
