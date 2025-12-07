# Building a Figma Site Mapper: An AI-Assisted Development Journey

## What's This Plugin About and Why Does It Exist?

After months of pondering what AI would mean for my career as a developer, I decided to stop theorizing and start building. The answer to "what will AI do to my profession?" turned out to be simple: let's find out by actually using it to build something real.

This is the story of building a Figma plugin for automated sitemap generation and design system documentation—and doing it almost entirely with AI-assisted development.

*(Note: This project is still in active development, and this post will be updated as the codebase evolves.)*

**Project Repository:** https://github.com/chillyweather/figma-site-mapper

## The Problem I'm Solving

**The Goal:** Create a plugin that simplifies and accelerates the mapping of Design System elements. In plain English—documenting and systematizing all the components of a website or web application.

Done manually, this process can take dozens of hours. Any automation here is worth its weight in gold.

## The Approach: AI-First Development

**The Method:** Use agentic coding as much as possible, writing code by hand only when the AI agent gets stuck on a problem.

I wanted to test the limits of AI-assisted development in a real, production-quality project. Not a toy app, but something architecturally complex with multiple services working together.

## Core Features (v1.0)

The plugin needs to deliver:

- **Screenshot capture** - Automated element detection on website pages
- **Visual markup** - Interactive elements (buttons, links, forms, etc.) highlighted on screenshots
- **Flow visualization** - Shows the chain of links between pages
- **Style analysis** - Design tokens and styling information for elements and the site overall
- **Authentication handling** - Support for password-protected sites

**[ADD GIF: Demo of the flow visualization feature]**

## Technical Architecture

The system consists of two main parts working together:

### Figma Plugin (Frontend)

The user-facing interface that runs inside Figma. It sends requests to the backend, receives processed data, and renders elements on the Figma canvas. Also handles user settings and project management.

**Tech:** TypeScript, React, Figma Plugin API

**[ADD SCREENSHOT: Plugin interface]**

### Backend Services

The backend is where the heavy lifting happens. Here's how it works:

#### The Architecture

The system uses a **job queue pattern** with three main components:

1. **REST API (Fastify)** - Receives requests from the plugin and manages data
2. **Job Queue (BullMQ + Redis)** - Handles asynchronous crawl jobs
3. **Worker Process** - Executes the actual web crawling and screenshot capture
4. **Database (MongoDB)** - Stores projects, pages, elements, and styling data

**Tech Stack:** Node.js, Fastify, BullMQ, MongoDB, Playwright, Crawlee

### How It All Works Together

When you start a crawl from the plugin, here's what happens behind the scenes:

**From UI Click to Screenshots on Canvas**

You click "Start Crawl" and the plugin sends your settings to the backend API. The server immediately creates a job in the queue and returns an ID—no waiting around. A background worker picks up the job and launches a real Chromium browser (headless by default, visible if you're debugging).

The browser navigates to each page, waits for everything to load, scrolls through to trigger lazy-loading, and captures full-page screenshots. If a page is taller than 4096px, it gets automatically sliced into manageable chunks. While browsing, it detects every interactive element—links, buttons, forms—and records their exact coordinates on the page.

All this data gets saved to MongoDB: screenshot paths, page metadata, element locations, and any CSS styles or design tokens the page uses. Meanwhile, your plugin polls the status endpoint every second, showing you a progress bar. When the job completes, the plugin fetches all the data and renders it on the Figma canvas—screenshot images, numbered badges on interactive elements, everything positioned and scaled properly.

**Highlighting Elements from the Markup Tab**

Here's where the database design pays off. All element data was captured during the initial crawl, so highlighting specific types is just a matter of filtering and visualization.

You check some boxes in the Markup tab—maybe "Buttons" and "Links." The plugin queries the `/elements` endpoint with your filters, and MongoDB returns only the matching elements. The plugin then draws colored rectangles on a "Page Overlay" frame: blue for buttons, green for links, each with a numbered badge. The metadata gets stored in Figma's plugin data, ready for when you want to build flows or analyze styles.

**Building User Flows from Link Clicks**

This is where things get interesting. When you click a link badge to create a flow, the plugin reads the badge's stored data to get the target URL. It clones your current screenshot plus the clicked link highlight, then checks if we've crawled that target URL before.

If it's in the database, great—we just fetch the data. If not, we trigger a fresh crawl for that single page (same process, smaller scope). Then the plugin creates a new Figma page with a source screenshot on the left, a big pink arrow pointing right, and the target screenshot on the right. Click another link in the target screenshot? It creates another nested flow page, building a breadcrumb trail of your user journey.

**Requesting Styles for Elements or Documents**

The styling features tap into CSS extraction that happened during the crawl. For document-wide styles, a request to `/styles/global` returns all the CSS variables from `:root`—your `--color-primary`, `--spacing-md`, and other design tokens. For individual elements, clicking a numbered badge fetches the complete style object: all CSS properties, which variables are referenced, computed values from browser rendering, and the element's selector.

The magic is that we inject JavaScript during the crawl that queries `getComputedStyle()` for thousands of elements, capturing the actual rendered CSS values—not just what's in stylesheets.

---

## Lessons Learned: Working with AI Agents

### Always Separate Planning from Execution

The process that worked best for me:

1. **Formulate the task** clearly in my own words
2. **Discuss possible approaches** with the AI agent—explore options
3. **Ask the agent to create a step-by-step plan** and save it to a `.md` file
4. **Execute one step at a time**—test after each stage, make clear commits when things work
5. **Iterate** based on what breaks or what new requirements emerge

### What Works Well with AI

- **Boilerplate and repetitive code** - The AI generates perfect CRUD endpoints, React components, and database schemas without breaking a sweat
- **API integrations and data transformations** - It handles the tedious work of mapping between different data formats and API responses
- **Refactoring and code organization** - Give it a messy function and get back clean, modular code with proper separation of concerns
- **Converting requirements into implementation plans** - It excels at breaking down "build a crawler" into 47 specific, actionable steps

### Where Human Oversight Still Matters

- **Architectural decisions** - The AI can implement any architecture you describe, but it won't question whether you're building a monolith or microservices for a Figma plugin
- **Debugging complex cross-service issues** - When the queue, worker, API, and plugin all blame each other, you need a human to trace the actual data flow
- **Performance optimization** - The AI writes correct code, but not always efficient code. That nested loop querying the database inside another loop? Still your problem to spot
- **Knowing when the AI is confidently wrong** - It once suggested storing screenshots as base64 in MongoDB. Technically possible. Practically a terrible idea. The confidence was impressive, though.

### What's Still Problematic

**Authentication** - Handling password-protected sites remains a work in progress. The current implementation works for basic cases but needs refinement for more complex authentication flows and session management.

---

## What's Next

**Deployment and Production Readiness**

The current setup runs everything locally—great for development, useless for collaboration. The deployment plan hit a practical wall: my target server has only 1GB of memory, and a full deployment of this project (Playwright browser instances + MongoDB + Redis + the Node.js services) immediately runs out of memory and crashes. The system needs at least 2GB to function, and realistically 4GB for comfortable operation with multiple concurrent crawls.

This means either upgrading the server infrastructure or optimizing the memory footprint before production deployment. For now, development continues locally while I explore options for a more appropriately sized hosting environment.

**Future Features on the Horizon**

- **Smart element grouping** - Automatically identify design system components across pages ("these 47 buttons all have the same styles, maybe they're the same component?")
- **Collaborative projects** - Multiple designers working on the same crawl data, with conflict resolution
- **Export formats** - Generate documentation in Markdown, JSON, or even Figma's own design system format
- **Visual regression testing** - Re-crawl sites and highlight what changed since the last capture
- **AI-powered analysis** - "Based on these 200 pages, your design system has 17 different button variants. Might want to consolidate?"

**Future Features on the Horizon**

- **Smart element grouping** - Automatically identify design system components across pages ("these 47 buttons all have the same styles, maybe they're the same component?")
- **Collaborative projects** - Multiple designers working on the same crawl data, with conflict resolution
- **Export formats** - Generate documentation in Markdown, JSON, or even Figma's own design system format
- **Visual regression testing** - Re-crawl sites and highlight what changed since the last capture
- **AI-powered analysis** - "Based on these 200 pages, your design system has 17 different button variants. Might want to consolidate?"

**Timeline** - Realistically, v1.0 production-ready by end of Q1 2025. The core functionality is there; now it's about hardening, testing, and making it work for people who aren't me.

---

## Try It Yourself

The project is open source and available on GitHub: https://github.com/chillyweather/figma-site-mapper

**Quick Start**

```bash
# Clone and install
git clone https://github.com/chillyweather/figma-site-mapper.git
cd figma-site-mapper
pnpm install

# Set up environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your MongoDB Atlas credentials

# Run development servers
pnpm dev
```

**Loading in Figma**

1. Open Figma Desktop → Plugins → Development → Import plugin from manifest
2. Select `packages/plugin/manifest.json`
3. The plugin appears in your Plugins menu

**Requirements**

- Node.js 18+ and pnpm
- Figma Desktop App
- MongoDB Atlas account (free tier works for testing)
- Redis (optional, for queue management)

For detailed setup instructions and troubleshooting, see the [README](https://github.com/chillyweather/figma-site-mapper/blob/main/README.md).

---

**Want to follow the journey?** Connect with me on [LinkedIn](https://www.linkedin.com/in/dmitridmitriev/) where I share updates on AI-assisted development and full-stack projects.
