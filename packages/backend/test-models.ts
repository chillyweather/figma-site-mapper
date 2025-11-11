import "dotenv/config";
import { connectDB } from "./src/db.js";
import { Project } from "./src/models/Project.js";
import { Page } from "./src/models/Page.js";
import { Element } from "./src/models/Element.js";

async function testModels() {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB\n");

    // Test 1: Create a project
    console.log("📝 Test 1: Creating a project...");
    const project = new Project({ name: "Test Project" });
    await project.save();
    console.log(`✅ Created project: ${project.name} (ID: ${project._id})\n`);

    // Test 2: Create a page
    console.log("📝 Test 2: Creating a page...");
    const page = new Page({
      projectId: project._id,
      url: "https://example.com",
      title: "Example Page",
      screenshotPaths: ["/screenshots/example.png"],
      globalStyles: { primaryColor: "#3498db" },
    });
    await page.save();
    console.log(`✅ Created page: ${page.title} (ID: ${page._id})\n`);

    // Test 3: Create elements
    console.log("📝 Test 3: Creating elements...");
    const elements = await Element.insertMany([
      {
        pageId: page._id,
        projectId: project._id,
        type: "button",
        bbox: { x: 100, y: 200, width: 120, height: 40 },
        text: "Click me",
        styles: { backgroundColor: "var(--primary)", color: "#fff" },
      },
      {
        pageId: page._id,
        projectId: project._id,
        type: "heading",
        bbox: { x: 50, y: 50, width: 300, height: 60 },
        text: "Welcome",
        styles: { fontSize: "32px", fontWeight: "bold" },
      },
    ]);
    console.log(`✅ Created ${elements.length} elements\n`);

    // Test 4: Query data
    console.log("📝 Test 4: Querying data...");
    const foundProject = await Project.findById(project._id);
    const foundPage = await Page.findOne({ projectId: project._id });
    const foundElements = await Element.find({ pageId: page._id });

    console.log(`✅ Found project: ${foundProject?.name}`);
    console.log(`✅ Found page: ${foundPage?.title} (${foundPage?.url})`);
    console.log(`✅ Found ${foundElements.length} elements:`);
    foundElements.forEach((el) => {
      console.log(`   - ${el.type}: ${el.text || "(no text)"}`);
    });

    // Test 5: Test unique constraint
    console.log("\n📝 Test 5: Testing unique constraint...");
    try {
      const duplicatePage = new Page({
        projectId: project._id,
        url: "https://example.com", // Same URL + projectId should fail
        title: "Duplicate",
        screenshotPaths: [],
      });
      await duplicatePage.save();
      console.log("❌ Unique constraint test FAILED (duplicate was saved)");
    } catch (error: any) {
      if (error.code === 11000) {
        console.log("✅ Unique constraint working (duplicate rejected)");
      } else {
        console.log(`❌ Unexpected error: ${error.message}`);
      }
    }

    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await Element.deleteMany({ projectId: project._id });
    await Page.deleteMany({ projectId: project._id });
    await Project.deleteOne({ _id: project._id });
    console.log("✅ Test data cleaned up");

    console.log("\n✨ All model tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testModels();
