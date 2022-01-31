import { Application } from "https://deno.land/x/oak@v10.2.0/mod.ts";
import { join } from "https://deno.land/std@0.123.0/path/mod.ts";
import bot from "./bot.ts";
import { config } from "./config.ts";

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
      const game = url.searchParams.get("game") as string | null;
      const user_id = url.searchParams.get("user_id") as string | null;
      const inline_id = url.searchParams.get("inline_id") as string | null;
      const chat_id = url.searchParams.get("chat_id") as string | null;
      const message_id = url.searchParams.get("message_id") as string | null;
      if (!game || !user_id || (!inline_id && (!chat_id || !message_id))) {
        throw null;
      }
      const score = await ctx.request.body({ type: "json" }).value;
      if (typeof score != "number") throw null;
      let data: any;
      if (inline_id) {
        await bot.api.setGameScoreInline(inline_id!, +user_id, score);
        data = await bot.api.getGameHighScoresInline(inline_id!, +user_id);
      } else {
        await bot.api.setGameScore(+chat_id!, +message_id!, +user_id, score);
        data = await bot.api.getGameHighScores(+chat_id!, +message_id!, +user_id);
      }
      ctx.response.status = 200;
      ctx.response.body = data;
    } catch {
      ctx.response.status = 403;
    }
    return
  }
  try {
    await ctx.send({ root });
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
