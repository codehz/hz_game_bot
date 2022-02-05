import { Bot } from "https://deno.land/x/grammy@v1.6.2/mod.ts";
import { config, secret } from "./config.ts";

const bot = new Bot(secret.token, {
  client: {
    apiRoot: config.api ?? "https://api.telegram.org",
  },
});

await bot.api.logOut();

Deno.exit(0);