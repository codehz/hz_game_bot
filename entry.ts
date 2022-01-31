import bot from "./bot.ts";
import web from "./server.ts";

await Promise.all([bot.start(), web])
