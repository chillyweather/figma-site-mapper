# Building a Figma Site Mapper: An AI-Assisted Development Journey

## What's This Plugin About and Why Does It Exist?

After months of pondering what AI would mean for my career as a developer, I decided to stop theorizing and start building. The answer to "what will AI do to my profession?" turned out to be simple: let's find out by actually using it to build something real.

This is the story of building a Figma plugin for automated sitemap generation and design system documentation—and doing it almost entirely with AI-assisted development.

_(Note: This project is still in active development, and this post will be updated as the codebase evolves.)_

**Project Repository:** https://github.com/chillyweather/figma-site-mapper

## The Problem I'm Solving

**The Goal:** Create a plugin that simplifies and accelerates the mapping of Design System elements. In plain English—documenting and systematizing all the components of a website or web application.

Done manually, this process can take dozens of hours. Any automation here is worth its weight in gold.

## The Approach: AI-First Development

**The Method:** Use agentic coding as much as possible, writing code by hand only when the AI agent gets stuck on a problem.

I wanted to test the limits of AI-assisted development in a real, production-quality project. Not a toy app, but something architecturally complex with multiple services working together.

## Core Features (v1.0)

The plugin needs to deliver:

- **Screenshot capture** of website pages with automated element detection
- **Visual markup** of interactive elements (buttons, links, forms, etc.) on those screenshots
- **Flow visualization** showing the chain of links between pages
- **Style analysis** displaying design tokens and styling information for elements and the site overall
- **Authentication handling** for password-protected sites

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

**1. From UI Click to Screenshots on Canvas**

Let's walk through the entire journey when you click "Start Crawl":

- **Plugin UI → Backend API**: Your crawl settings (URL, depth, filters) get sent to `/crawl` endpoint
- **API Creates a Job**: The server creates a job in the BullMQ queue with a unique ID and returns it immediately
- **Worker Picks Up Job**: A background worker process grabs the job and fires up Playwright
- **Browser Does Its Thing**:
  - Launches a real Chromium browser (headless or visible)
  - Navigates to each page, waits for content to load
  - Scrolls through the page to trigger lazy-loading
  - Captures full-page screenshots (auto-sliced if taller than 4096px)
  - Detects all interactive elements (links, buttons) with their exact coordinates
  - Optionally extracts CSS styles, design tokens, and computed properties
- **Data Gets Saved**: Each page's data goes into MongoDB:
  - Screenshot file paths
  - Page metadata (title, URL, crawl timestamp)
  - Interactive elements with bounding boxes
  - Style information and CSS variables
- **Plugin Polls for Updates**: Meanwhile, your plugin checks `/status/{jobId}` every second
- **Rendering Time**: When complete, plugin fetches the data and builds Figma frames with:
  - Screenshot images loaded from backend server
  - Interactive overlay with numbered badges on every link/button
  - Proper positioning and scaling for Figma canvas

**2. Highlighting Elements from the Markup Tab**

When you want to highlight specific element types (buttons, inputs, etc.):

- **Select Element Types**: You check boxes in the Markup tab (e.g., "Buttons" + "Links")
- **Plugin Queries Database**: Sends request to `/elements` endpoint with your filters
- **Backend Filters Elements**: MongoDB query returns only elements matching your selected types
- **Visual Highlights Appear**: Plugin draws colored rectangles on the "Page Overlay" frame:
  - Each element type gets its own color (buttons = blue, links = green, etc.)
  - Numbered badges appear in the top-right corner
  - Element metadata stored in Figma's plugin data for later reference

The magic is that all element data was already captured during the initial crawl—this is just filtering and visualizing what's in the database.

**3. Building User Flows from Link Clicks**

This is where things get interesting. When you click a link badge to create a flow:

- **Identify the Link**: Plugin reads the badge's plugin data to get the target URL
- **Clone Current View**: Copies your current screenshot + the clicked link highlight
- **Check Cache First**: Queries `/page` endpoint—have we crawled this target URL before?
- **Crawl If Needed**: If not cached, triggers a fresh crawl just for that one page:
  - Sends a `/recrawl-page` request (same process as full crawl, but single page)
  - Worker crawls the target URL with all the same screenshot + element detection
  - Saves results to database
- **Create Flow Page**: Plugin creates a new Figma page with hierarchical naming:
  - Source screenshot on the left
  - Big pink arrow pointing right (created as a vector with arrow cap)
  - Target screenshot on the right
  - All interactive elements detected and ready to click
- **Chain Flows**: Click another link in the target screenshot? It creates another nested flow page, building a breadcrumb trail of your user journey

**4. Requesting Styles for Elements or Documents**

The styling features tap into CSS extraction that happened during crawl:

**For Document Styles** (the whole page):

- **Query Global Styles**: Request to `/styles/global` returns CSS variables from `:root`
- **Display Design Tokens**: Shows all the `--color-primary`, `--spacing-md` type variables
- **Cross-Page Analysis**: Can aggregate tokens across multiple pages to find design system patterns

**For Individual Elements**:

- **Select an Element**: Click a numbered badge from the markup overlay
- **Fetch Element Data**: Request to `/styles/element` with element ID
- **Show Computed Styles**: Displays the full style object:
  - All CSS properties (color, font-size, padding, etc.)
  - Which CSS variables are referenced
  - Computed values from browser rendering
  - Element's selector and tagname

The styling extraction happens in the browser during crawl—we inject JavaScript that queries `getComputedStyle()` for thousands of elements, capturing the actual rendered CSS values, not just what's in stylesheets.

---

## Lessons Learned: Working with AI Agents

### Always Separate Planning from Execution

The process that worked best for me:

1. **Formulate the task** clearly in my own words
2. **Discuss possible approaches** with the AI agent—explore options
3. **Ask the agent to create a step-by-step plan** and save it to a `.md` file
4. **Execute one step at a time**—test after each stage, make clear commits when things work
5. **Iterate** based on what breaks or what new requirements emerge

**[MISSING SECTION: Add 2-3 specific examples of challenges and how AI helped solve them]**

### What Works Well with AI

- Boilerplate and repetitive code
- API integrations and data transformations
- Refactoring and code organization
- Converting requirements into implementation plans

### Where Human Oversight Still Matters

- Architectural decisions
- Debugging complex cross-service issues
- Performance optimization
- Knowing when the AI is confidently wrong

**[ADD CODE SNIPPET: Example of an interesting problem solved with AI assistance]**

---

## What's Next

**[MISSING SECTION: Deployment plans, future features, and timeline]**

---

## Try It Yourself

The project is open source and available on GitHub: https://github.com/chillyweather/figma-site-mapper

**[MISSING SECTION: Installation/usage instructions or link to docs]**

---

**Want to follow the journey?** Connect with me on [LinkedIn](https://www.linkedin.com/in/dmitridmitriev/) where I share updates on AI-assisted development and full-stack projects.

---

## Missing Content Summary

To complete this post, you'll need to add:

1. **GIF/Video:** Flow visualization demo
2. **Screenshot:** Plugin interface
3. **Diagram:** System architecture
4. **Expanded section:** Backend architecture details
5. **Section:** 2-3 specific AI-assisted problem-solving examples
6. **Code snippet:** Interesting technical challenge example
7. **Section:** Deployment plans and future roadmap
8. **Section:** Quick start / how to use it

The structure is there—now it's ready for the technical meat and visual aids that will make it compelling!
