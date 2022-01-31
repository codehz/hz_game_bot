import { Application } from "https://deno.land/x/oak@v10.2.0/mod.ts";
import { join } from "https://deno.land/std@0.123.0/path/mod.ts";
import bot from "./bot.ts";
import { config } from "./config.ts";
import type { Payload } from "./types.ts";
import { decode } from "./jwt.ts";

const root = join(Deno.cwd(), config.static);

export const app = new Application();

app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

app.use(async (ctx, next) => {
  if (ctx.request.method as any == "SCORE") {
    try {
      const url = new URL(ctx.request.headers.get("referer")!);
      const data = url.searchParams.get("data");
      if (!data) throw null;
      const {
        game,
        user_id,
        inline_message_id,
        chat_id,
        message_id,
      } = await decode<Payload>(data);
      if (!game || !user_id || (!inline_message_id && (!chat_id || !message_id))) {
        throw null;
      }
      const score = await ctx.request.body({ type: "json" }).value;
      if (typeof score != "number") throw null;
      try {
        await bot.api.raw.setGameScore({
          user_id,
          chat_id,
          inline_message_id,
          message_id,
          score,
        });
      } catch ({ description }) {
        if (
          typeof description != "string" ||
          !description.includes("BOT_SCORE_NOT_MODIFIED")
        ) {
          throw null;
        }
      }
      const body = await bot.api.raw.getGameHighScores({
        user_id,
        chat_id,
        inline_message_id,
        message_id,
      });
      ctx.response.status = 200;
      ctx.response.body = body;
    } catch (e) {
      if (e) console.error(e);
      ctx.response.status = 403;
    }
    return;
  }
  try {
    await ctx.send({ root, index: "index.html" });
  } catch {
    next();
  }
});

app.addEventListener("listen", ({ hostname, port, serverType }) => {
  console.log(
    "Start listening on " + `${hostname}:${port}`,
  );
  console.log("  using HTTP server: " + serverType);
});

export default app.listen({ port: 8080 });
