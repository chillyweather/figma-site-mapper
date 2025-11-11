import "dotenv/config";
import mongoose, { connectDB } from "./src/db.js";
import { buildServer } from "./src/app.js";
import { Project } from "./src/models/Project.js";

async function main() {
  try {
    await connectDB();
    const server = await buildServer();
    await server.ready();

    // Clean slate before testing
    await Project.deleteMany({});

    const createResponse = await server.inject({
      method: "POST",
      url: "/projects",
      payload: { name: "Endpoint Test Project" },
    });

    if (createResponse.statusCode !== 200) {
      throw new Error(`POST /projects failed: ${createResponse.body}`);
    }

    const { project } = createResponse.json() as any;
    console.log("POST /projects response:", project);

    const listResponse = await server.inject({
      method: "GET",
      url: "/projects",
    });

    if (listResponse.statusCode !== 200) {
      throw new Error(`GET /projects failed: ${listResponse.body}`);
    }

    const { projects } = listResponse.json() as any;
    console.log(`GET /projects returned ${projects.length} project(s)`);

    await Project.deleteMany({});

    await server.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Endpoint test failed:", error);
    process.exit(1);
  }
}

main();
