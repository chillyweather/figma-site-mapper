import "dotenv/config";
import { connectDB } from "./src/db.js";
import mongoose from "mongoose";

async function testConnection() {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // List all databases
    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();

    console.log("\n📁 Available databases:");
    databases.forEach((db: any) => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024).toFixed(2)} KB)`);
    });

    // Check current database
    console.log(
      `\n🎯 Current database: ${mongoose.connection.db.databaseName}`
    );

    // List collections in current database
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log(
      `\n📚 Collections in '${mongoose.connection.db.databaseName}':`
    );
    if (collections.length === 0) {
      console.log("  (empty - no collections yet)");
    } else {
      collections.forEach((coll: any) => {
        console.log(`  - ${coll.name}`);
      });
    }

    console.log("\n✨ Connection test successful!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection test failed:", error);
    process.exit(1);
  }
}

testConnection();
