import pino from "pino";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { format } from "util";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir))
    fs.mkdirSync(logsDir, { recursive: true });
export const logFile = path.join(logsDir, "app.log");
const prettyTarget = {
    target: "pino-pretty",
    level: "info",
    options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
};
const rollTarget = {
    target: "pino-roll",
    level: "debug",
    options: { file: logFile, frequency: "daily", mkdir: true, limit: { count: 2 } },
};
// Inline Fastify logger config — pass this to Fastify({ logger: fastifyLoggerConfig }).
export const fastifyLoggerConfig = {
    level: "info",
    transport: { targets: [prettyTarget, rollTarget] },
};
// Standalone pino logger for the worker process.
export const logger = pino({ level: "debug" }, pino.transport({ targets: [prettyTarget, rollTarget] }));
// Redirect console.* so crawler logs land in the log file automatically.
const con = logger.child({ source: "console" });
console.log = (...args) => con.info(format(...args));
console.info = (...args) => con.info(format(...args));
console.warn = (...args) => con.warn(format(...args));
console.error = (...args) => con.error(format(...args));
console.debug = (...args) => con.debug(format(...args));
