import "dotenv/config";
import { connectDB } from "./db.js";
import { buildServer } from "./app.js";
const start = async () => {
    try {
        await connectDB();
        const server = await buildServer();
        await server.listen({ port: 3006 });
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
};
start();
