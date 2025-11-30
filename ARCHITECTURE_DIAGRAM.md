# Figma Site Mapper - Complete Architecture & Functionality Diagram

## System Overview

```mermaid
graph TB
    subgraph "Figma Plugin (Frontend)"
        UI[React UI]
        Plugin[Plugin Backend]
    end
    
    subgraph "Backend Server"
        API[Fastify API Server]
        Crawler[Playwright Crawler]
        Queue[Bull Queue/Redis]
        Worker[Queue Worker]
    end
    
    subgraph "Data Storage"
        MongoDB[(MongoDB Atlas)]
        Files[Screenshots & Files]
    end
    
    UI -->|HTTP Requests| API
    Plugin -->|Message Bridge| UI
    API -->|Queue Jobs| Queue
    Queue -->|Process| Worker
    Worker -->|Execute| Crawler
    Crawler -->|Store Data| MongoDB
    Crawler -->|Save Files| Files
    API -->|Read/Write| MongoDB
    Plugin -->|Read URLs| Files
```

## Core Functionality Flow

```mermaid
flowchart TD
    Start([User Opens Plugin]) --> SelectProject{Project Selected?}
    SelectProject -->|No| CreateProject[Create/Select Project]
    CreateProject --> ProjectReady
    SelectProject -->|Yes| ProjectReady[Project Ready]
    
    ProjectReady --> ChooseTab{Choose Tab}
    
    ChooseTab -->|Crawling| Crawl[Crawling Tab]
    ChooseTab -->|Markup| Markup[Markup Tab]
    ChooseTab -->|Flows| Flows[Flows Tab]
    ChooseTab -->|Styling| Styling[Styling Tab]
    ChooseTab -->|Settings| Settings[Settings View]
    
    Crawl --> CrawlOptions[Configure Crawl Options]
    CrawlOptions --> StartCrawl[Start Crawl]
    StartCrawl --> CrawlProcess[Backend Crawls Website]
    CrawlProcess --> SaveToDB[Save to MongoDB]
    SaveToDB --> RenderSitemap[Render Sitemap in Figma]
    
    Markup --> SelectPage[Select Screenshot Frame]
    SelectPage --> ChooseElements[Choose Element Types to Highlight]
    ChooseElements --> RenderMarkup[Render Element Highlights]
    
    Flows --> ScanBadges[Scan Page for Badge Links]
    ScanBadges --> SelectLinks[Select Target Links]
    SelectLinks --> BuildFlow[Build Flow]
    BuildFlow --> CheckPageExists{Page in DB?}
    CheckPageExists -->|Yes| ClonePage[Clone Existing Frame]
    CheckPageExists -->|No| CrawlNewPage[Crawl New Page]
    CrawlNewPage --> AddToFlow[Add to Flow]
    ClonePage --> AddToFlow
    
    Styling --> StylingChoice{Choose Action}
    StylingChoice -->|Global| GlobalStyles[Render Global Styles Table]
    StylingChoice -->|Element| SelectElement[Select Element on Canvas]
    SelectElement --> ElementStyles[Render Element Styles Table]
```

## Detailed Feature Map

```mermaid
mindmap
  root((Figma Site Mapper))
    Project Management
      Create Project
      Select Project
      Switch Between Projects
      Project Persistence
    
    Crawling
      Full Site Crawl
        Multi-page crawling
        Depth control
        Max pages limit
        Language filtering
        Section sampling
      Single Page Crawl
        Re-crawl existing page
        Crawl for flow target
      Authentication
        Cookie-based auth
        Credentials auth
        Manual auth session
        CAPTCHA handling
      Screenshot Capture
        Full page screenshots
        Screenshot slicing
        Scale factor control
        Width configuration
      Data Extraction
        Interactive elements
        Links and buttons
        Form elements
        Text elements
        Structural elements
        Media elements
      Style Extraction
        CSS variables/tokens
        Colors
        Typography
        Spacing
        Layout properties
        Borders
        Computed styles
      Progress Tracking
        Stage reporting
        Page count
        Current URL
        Progress percentage
    
    Sitemap Rendering
      Tree Structure
        Hierarchical layout
        Parent-child relationships
        Ordered pages
      Screenshot Display
        Multi-slice support
        Proper sizing
        URL metadata
      Page Numbering
        Crawl order tracking
        Numbered titles
    
    Markup System
      Element Highlighting
        Links
        Buttons
        Headings
        Paragraphs
        Form inputs
        Textareas
        Select dropdowns
        Images
        Divs
        Other elements
      Interactive Badges
        Element numbering
        Click detection
        Visual indicators
      Filter Controls
        Select element types
        Toggle categories
        Real-time filtering
      On-Demand Rendering
        Fetch from database
        Apply to current page
        Clear existing markup
    
    Flow Building
      Badge Scanning
        Auto-detect links
        Parse button targets
        Position tracking
      Link Selection
        Checkbox selection
        Multi-link support
        Link metadata display
      Flow Generation
        Check page existence
        Clone or crawl
        Sequential layout
        Connection indicators
      Progress Tracking
        Current page
        Total pages
        Status updates
    
    Styling Analysis
      Global Styles
        CSS Custom Properties
        Design tokens
        Color palettes
        Font families
        Variable values
        Token usage tracking
      Element Styles
        Per-element analysis
        Token-based styles
        Computed fallbacks
        Style properties
        Visual representation
        Style tables
      Style Rendering
        Global styles table
        Element styles table
        Property display
        Value formatting
    
    Settings
      Screenshot Settings
        Width
        Scale factor
        Quality control
      Crawl Settings
        Max requests
        Max depth
        Sample size
        Request delay
        Page delay
        Language filtering
      Authentication
        Method selection
        Credentials
        Cookie management
        Login URL
      Element Detection
        Interactive elements
        All elements
        Element filters
      Style Extraction
        Preset selection
        Element categories
        Style categories
        Selector options
        Computed styles
      Advanced Options
        Show browser
        Full refresh
        Default language only
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant FigmaUI as Figma UI (React)
    participant PluginCode as Plugin Code
    participant API as Backend API
    participant Queue as Job Queue
    participant Crawler as Crawler Worker
    participant DB as MongoDB
    participant Storage as File Storage

    User->>FigmaUI: 1. Start Crawl
    FigmaUI->>PluginCode: 2. Message: start-crawl
    PluginCode->>API: 3. POST /crawl
    API->>DB: 4. Verify Project
    API->>Queue: 5. Add Job
    API-->>PluginCode: 6. Return jobId
    PluginCode-->>FigmaUI: 7. Crawl Started
    
    Queue->>Crawler: 8. Process Job
    Crawler->>Crawler: 9. Open Browser
    Crawler->>Crawler: 10. Visit Pages
    Crawler->>Storage: 11. Save Screenshots
    Crawler->>DB: 12. Upsert Page Data
    Crawler->>DB: 13. Insert Element Data
    Crawler-->>API: 14. Update Progress
    API-->>PluginCode: 15. Progress Updates
    
    PluginCode->>API: 16. Poll Status
    API->>Queue: 17. Check Job
    API-->>PluginCode: 18. Status Response
    
    Crawler->>DB: 19. Save Global Styles
    Crawler-->>Queue: 20. Mark Complete
    
    PluginCode->>API: 21. GET /pages/by-ids
    API->>DB: 22. Query Pages & Elements
    DB-->>API: 23. Return Data
    API-->>PluginCode: 24. Manifest Data
    
    PluginCode->>PluginCode: 25. Render Sitemap
    PluginCode->>Storage: 26. Fetch Screenshots
    PluginCode->>PluginCode: 27. Create Figma Nodes
    PluginCode-->>FigmaUI: 28. Complete!
    FigmaUI-->>User: 29. Show Success
```

## Database Schema

```mermaid
erDiagram
    PROJECTS ||--o{ PAGES : contains
    PROJECTS ||--o{ ELEMENTS : owns
    PAGES ||--o{ ELEMENTS : has
    
    PROJECTS {
        ObjectId _id PK
        string name
        date createdAt
        date updatedAt
    }
    
    PAGES {
        ObjectId _id PK
        ObjectId projectId FK
        string url UK
        string title
        array screenshotPaths
        array interactiveElements
        object globalStyles
        date lastCrawledAt
        string lastCrawlJobId
        date createdAt
        date updatedAt
    }
    
    ELEMENTS {
        ObjectId _id PK
        ObjectId projectId FK
        ObjectId pageId FK
        string type
        string selector
        string tagName
        string elementId
        array classes
        object bbox
        string href
        string text
        object styles
        array styleTokens
        string ariaLabel
        string role
        string value
        string placeholder
        boolean checked
        string src
        string alt
        date createdAt
    }
```

## Component Architecture (Plugin)

```mermaid
graph TB
    subgraph "Main Application"
        App[App Component]
        AppProvider[Jotai Provider]
    end
    
    subgraph "Views"
        MainView[Main View]
        SettingsView[Settings View]
    end
    
    subgraph "Tabs"
        CrawlingTab[Crawling Tab]
        MarkupTab[Markup Tab]
        FlowsTab[Flows Tab]
        StylingTab[Styling Tab]
    end
    
    subgraph "Custom Hooks"
        UseSettings[useSettings]
        UseCrawl[useCrawl]
        UseFlowMapping[useFlowMapping]
        UseMarkup[useMarkup]
        UseProjects[useProjects]
        UseElementData[useElementData]
    end
    
    subgraph "State Management"
        Atoms[Jotai Atoms]
        Storage[Client Storage]
    end
    
    subgraph "Plugin Services"
        APIClient[API Client]
        BadgeScanner[Badge Scanner]
        TargetPageRenderer[Target Page Renderer]
        ManifestBuilder[Manifest Builder]
        ImageUtils[Image Utils]
    end
    
    subgraph "Figma Rendering"
        RenderSitemap[Render Sitemap]
        CreateScreenshots[Create Screenshots]
        RenderElements[Render Elements]
        FlattenTree[Flatten Tree]
    end
    
    App --> AppProvider
    AppProvider --> MainView
    AppProvider --> SettingsView
    MainView --> CrawlingTab
    MainView --> MarkupTab
    MainView --> FlowsTab
    MainView --> StylingTab
    
    CrawlingTab --> UseCrawl
    MarkupTab --> UseMarkup
    FlowsTab --> UseFlowMapping
    StylingTab --> UseElementData
    
    UseCrawl --> APIClient
    UseMarkup --> APIClient
    UseFlowMapping --> BadgeScanner
    UseProjects --> APIClient
    
    UseSettings --> Atoms
    Atoms --> Storage
    
    APIClient --> ManifestBuilder
    ManifestBuilder --> RenderSitemap
    RenderSitemap --> CreateScreenshots
    RenderSitemap --> RenderElements
    RenderElements --> FlattenTree
```

## Backend API Endpoints

```mermaid
graph LR
    subgraph "Project Management"
        P1[GET /projects]
        P2[POST /projects]
    end
    
    subgraph "Crawling"
        C1[POST /crawl]
        C2[POST /recrawl-page]
        C3[GET /status/:jobId]
        C4[POST /progress/:jobId]
        C5[GET /jobs/:jobId/pages]
    end
    
    subgraph "Page Data"
        PD1[GET /page]
        PD2[GET /pages/by-ids]
    end
    
    subgraph "Element Data"
        E1[GET /elements]
    end
    
    subgraph "Style Data"
        S1[GET /styles/global]
        S2[GET /styles/element]
    end
    
    subgraph "Authentication"
        A1[POST /auth-session]
    end
    
    style P1 fill:#e1f5ff
    style P2 fill:#e1f5ff
    style C1 fill:#fff4e1
    style C2 fill:#fff4e1
    style C3 fill:#fff4e1
    style C4 fill:#fff4e1
    style C5 fill:#fff4e1
    style PD1 fill:#f0e1ff
    style PD2 fill:#f0e1ff
    style E1 fill:#e1ffe1
    style S1 fill:#ffe1e1
    style S2 fill:#ffe1e1
    style A1 fill:#ffe1f5
```

## Workflow Examples

### Full Crawl Workflow

```mermaid
flowchart TD
    Start([User Opens Plugin]) --> HasProject{Has Active Project?}
    HasProject -->|No| CreateProj[Create/Select Project]
    HasProject -->|Yes| ConfigCrawl[Configure Crawl Settings]
    CreateProj --> ConfigCrawl
    
    ConfigCrawl --> EnterURL[Enter Website URL]
    EnterURL --> SetOptions[Set Options:<br/>- Max Pages<br/>- Depth<br/>- Sample Size<br/>- Authentication]
    SetOptions --> StartCrawl[Click Start Crawl]
    
    StartCrawl --> Backend[Backend Processes]
    Backend --> BrowserOpen[Open Browser]
    BrowserOpen --> HandleAuth{Auth Required?}
    HandleAuth -->|Yes| AuthProcess[Handle Authentication]
    HandleAuth -->|No| StartNav[Start Navigation]
    AuthProcess --> StartNav
    
    StartNav --> VisitPage[Visit Page]
    VisitPage --> CheckCAPTCHA{CAPTCHA Detected?}
    CheckCAPTCHA -->|Yes| WaitSolve[Wait for Manual Solve]
    CheckCAPTCHA -->|No| ScrollPage[Scroll & Load Content]
    WaitSolve --> ScrollPage
    
    ScrollPage --> ExtractData[Extract:<br/>- Screenshot<br/>- Elements<br/>- Styles]
    ExtractData --> SaveDB[Save to MongoDB]
    SaveDB --> UpdateProgress[Update Progress]
    UpdateProgress --> MorePages{More Pages?}
    
    MorePages -->|Yes| VisitPage
    MorePages -->|No| BuildManifest[Build Manifest]
    
    BuildManifest --> RenderFigma[Render in Figma]
    RenderFigma --> CreatePages[Create Figma Pages]
    CreatePages --> AddScreenshots[Add Screenshots]
    AddScreenshots --> AddMetadata[Add Plugin Data]
    AddMetadata --> Done([Complete!])
```

### Flow Building Workflow

```mermaid
flowchart TD
    Start([User on Flows Tab]) --> ScanPage[Plugin Scans Current Page]
    ScanPage --> FindBadges[Find Badge Links/Buttons]
    FindBadges --> DisplayList[Display in Flows Tab]
    
    DisplayList --> UserSelects[User Selects Links]
    UserSelects --> ClickBuild[Click Show Flow]
    
    ClickBuild --> FirstPage[Start with Current Page]
    FirstPage --> NextLink[Process Next Link]
    
    NextLink --> CheckDB{Page in Database?}
    CheckDB -->|Yes| FindFrame[Find Figma Frame]
    FindFrame --> CloneIt[Clone Frame]
    CloneIt --> Position[Position in Flow]
    
    CheckDB -->|No| CrawlIt[Trigger Single-Page Crawl]
    CrawlIt --> SaveNew[Save to Database]
    SaveNew --> RenderNew[Render New Frame]
    RenderNew --> Position
    
    Position --> AddMarkup{Add Markup?}
    AddMarkup -->|Yes| FetchElements[Fetch Elements]
    FetchElements --> DrawHighlights[Draw Highlights]
    DrawHighlights --> MoreLinks{More Links?}
    AddMarkup -->|No| MoreLinks
    
    MoreLinks -->|Yes| NextLink
    MoreLinks -->|No| Done([Flow Complete!])
```

### Markup Workflow

```mermaid
flowchart TD
    Start([User on Markup Tab]) --> SelectFrame[Select Screenshot Frame]
    SelectFrame --> GetPageID[Read pageId from Frame]
    GetPageID --> ShowFilters[Show Element Type Filters]
    
    ShowFilters --> UserChecks[User Selects Types:<br/>- Links<br/>- Buttons<br/>- Inputs<br/>- etc.]
    UserChecks --> ClickRender[Click Render Markup]
    
    ClickRender --> FetchElements[GET /elements?pageId=X]
    FetchElements --> FilterTypes[Filter by Selected Types]
    FilterTypes --> ProcessElements[Process Each Element]
    
    ProcessElements --> CreateHighlight[Create Highlight Rectangle]
    CreateHighlight --> AddBadge[Add Numbered Badge]
    AddBadge --> SetColors[Apply Category Color]
    SetColors --> StoreData[Store Element Data]
    StoreData --> MoreElements{More Elements?}
    
    MoreElements -->|Yes| ProcessElements
    MoreElements -->|No| Done([Markup Complete!])
    
    Done --> UserClear{Clear Markup?}
    UserClear -->|Yes| RemoveAll[Remove All Highlights]
    RemoveAll --> ShowFilters
```

## Technology Stack

```mermaid
graph TB
    subgraph "Frontend"
        F1[React 18]
        F2[TypeScript]
        F3[Jotai State]
        F4[Figma Plugin API]
        F5[Vite Build]
    end
    
    subgraph "Backend"
        B1[Node.js]
        B2[TypeScript]
        B3[Fastify]
        B4[Crawlee]
        B5[Playwright]
    end
    
    subgraph "Data Layer"
        D1[MongoDB Atlas]
        D2[Mongoose ODM]
        D3[Bull Queue]
        D4[Redis]
    end
    
    subgraph "DevOps"
        DO1[npm/pnpm]
        DO2[Git]
        DO3[Environment Variables]
        DO4[Cloud Hosting]
    end
    
    F1 --> B3
    B3 --> B4
    B4 --> B5
    B5 --> D1
    D3 --> D4
    B3 --> D2
    D2 --> D1
```

## Key Features Summary

| Category | Features |
|----------|----------|
| **Project Management** | Create projects, Select active project, Multi-project support, Project persistence |
| **Web Crawling** | Full site crawl, Single page crawl, Authentication support, CAPTCHA handling, Progress tracking, Language filtering, Section sampling, Depth control |
| **Data Extraction** | Screenshots with slicing, Interactive elements (links/buttons), Form elements, Text elements, Style data, CSS tokens, Computed styles |
| **Sitemap Generation** | Hierarchical tree structure, Auto-layout, Screenshot display, Page numbering, Metadata storage |
| **Element Markup** | On-demand highlighting, Multiple element types, Color-coded categories, Numbered badges, Filter controls, Clear functionality |
| **Flow Building** | Badge scanning, Link selection, Auto page detection, Clone or crawl, Sequential layout, Progress tracking |
| **Style Analysis** | Global styles extraction, CSS variables/tokens, Per-element styles, Color palettes, Typography data, Style tables |
| **Settings** | Screenshot configuration, Crawl limits, Authentication setup, Element filters, Style extraction presets, Advanced options |

## System Benefits

1. **Persistent Data**: MongoDB stores all crawled data permanently
2. **Reusability**: Pages crawled once can be reused across multiple flows
3. **Collaboration**: Multiple users can work on same project
4. **Incremental Updates**: Recrawl specific pages without full site crawl
5. **Style Token Tracking**: CSS variables and design tokens preserved
6. **Element-Level Analysis**: Detailed per-element styling information
7. **Flexible Markup**: On-demand element highlighting with filters
8. **Efficient Flows**: Clone existing pages instead of re-crawling
9. **Scalable Architecture**: Queue-based processing for concurrent crawls
10. **Rich Metadata**: Complete page and element data for analysis
