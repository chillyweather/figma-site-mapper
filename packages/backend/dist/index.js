import "dotenv/config";
import "./logger.js"; // must be first — redirects console.* to pino
import { connectDB } from "./db.js";
import { buildServer } from "./app.js";
import { logger } from "./logger.js";
const start = async () => {
    try {
        await connectDB();
        const server = await buildServer();
        await server.listen({ port: 3006 });
    }
    catch (err) {
        logger.error(err, "Failed to start server");
        process.exit(1);
    }
};
start();
