So let's think what and how should be done (parts of the process and architecture).

For database - I want to use MongoDB Atlas (from now I will write just Atlas or db). Users will be connected to the system by adding Atlas credential to the plugin settings.

Here are my thoughts, feel free to correct of update me.

1. It is always starts with crawl. We can crawl many pages (whole site), or only one page.

   - I want all the possible data to be gathered at once. So positions and sizes of the elements, styling data for each element and targets of links and buttons, plus tokens, CSS variables, fonts, colors and other styling data for app/page.
   - I think, we should keep our data in DB separated by web page. Keys for elements inside - URL, it will make them easily search-able and update-able.
   - Our typical mapping project takes weeks, so if we need data on this page again - we may take it from DB, since most of the web sites not updated that often (I will return to this later).
   - So on crawl we do:
     - Screenshots on canvas in Figma. With each screenshot we need to save URL of the crawled page. We may use plugindata in Figma, or just naming of the screenshot frame.
     - Data on elements of the page in Atlas
     - Highlights over elements of the page in Figma (probably on the basis of the data from Atlas). We need option in settings for which elements we are intend to highlight: buttons and links, text elements, inputs, something else, all at once, etc.
     - Since data for every crawled page is saved in Atlas, after crawl, even later, even if there is no highlights on canvas yet we may ask plugin to build highlights for links, or buttons, or form elements. Highlights for buttons/links should contain all necessary data for flow-building.
     - So probably we need new tab "Markup". Where we can select types of the elements we want to highlight on given page and action button.

2. After initial crawl is done, we have three choices:

   1. Another crawl
   2. Flow-building
   3. Styles / token analysis

   **Let's take a look at each one of them**:

   1. **Crawl** - always fresh and new. On crawl add or update data from database. If sub-page doesn't exist in Atlas - its data will be added, if it is already exists - updated.
   2. **Flow-building** - for this flow we need highlights for buttons/links on canvas. When in UI we select link or button and click "Build flow" button, plugin should check if this (target) page was already crawled.
      1. If it was - we may just copy screenshot frame from other page in figma.
      2. If not - plugin does regular scroll and adds screenshot to the canvas.
      3. Probably we need add checkbox "Add markup" to flow building button. In case when we know that we are going to build chain of the pages. Actually, that's our current default behavior.
      4. If this checkbox unchecked plugin just builds screenshot frame and adds/updates data in db. Highlights can be added later from "Markup" tab.
   3. **Styles/tokens** - here we will have two possible flows:
      1. Get styling data for app as a table of tokes (what we already have now, though it will be probably updated an improved).
      2. After selecting in the markup page the kind(s) of element we are interested in and building highlights on cavas, in the tab "Styling" we should see list of element by numbers, exactly like we have in the "Flows" tab for ling/button elements. When we select one and click action button ("Show styling data", or something like that), plugin will build on canvas small table per element with some legend about which element that data relates to. Design for this moment is not relevant.

This functionality should be enough for this stage of the project.

Reliability is super important.

Potential scalability and open for the new features architecture is very important too.

Analyze these requests in the context of our previous discussion and existing code.

Ask additional questions if you have ones.

Propose changes and improvements.

After that, convert prepare for me clear technical requirements for this project. Save them as separate md file. Then build step-by-step implementation plan. Save it as another .md file.
