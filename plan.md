 # Plan for Stage 2 - mapping user journeys

## Phase 1: Backend - Capturing Element-Level Data
Our crawler is great at the page level, but now we need it to look inside each page.

1.1: Identify Interactive Elements
We'll enhance the requestHandler in our crawler. For each page, we'll use Playwright's locators to find all clickable elements, like <a> tags, <button> tags, and any other elements with a role="button" or a JavaScript click handler.

1.2: Capture Element Data
For each interactive element we find, we'll capture three key pieces of information:

Bounding Box: Its exact position and size on the page (x, y, width, height) using Playwright's element.boundingBox() method.

Element Screenshot: A small, focused screenshot of just that element using element.screenshot().

Destination URL: The href attribute of the link it points to.

1.3: Enhance the manifest.json
We'll update our manifest structure. Each page node in the tree will now contain a new array, something like interactiveElements. Each object in this array will hold the data for one button or link: its bounding box, the URL to its focused screenshot, and its destination URL.

## Phase 2: Figma - Visualizing the Journeys
That's still open question, for now let's just have data on where we are clicking and where this click should bring us to.
