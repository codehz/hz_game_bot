import { Router } from "https://deno.land/x/oak@v10.2.0/mod.ts";
import { decode } from "./jwt.ts";
import {
  addToBlockList,
  fetchSession,
  isAdmin,
  listBlockList,
  listSession,
  queryLog,
  querySessionForUser,
} from "./config.ts";
import bot from "./bot.ts";

const admin = new Router({ prefix: "/api" });

admin.use(async (ctx, next) => {
  try {
    const url = new URL(ctx.request.headers.get("referer")!);
    const data = url.searchParams.get("data");
    if (!data) throw null;
    const { user_id } = await decode<{ user_id: number }>(data);
    if (!isAdmin(user_id)) throw null;
    return next();
  } catch {
    ctx.response.status = 403;
    return;
  }
});

admin.get("/", (ctx) => {
  ctx.response.body = "pong";
  ctx.response.status = 200;
});

admin.get("/sessions", (ctx) => {
  const list: {
    id: number;
    game: string;
    inline_message_id?: string;
    chat_id?: number;
    message_id?: number;
    count: number;
  }[] = [];
  for (
    const [id, game, inline_message_id, chat_id, message_id, count]
      of listSession
        .query()
  ) {
    list.push({ id, game, inline_message_id, chat_id, message_id, count });
  }
  ctx.response.body = list;
  ctx.response.status = 200;
});

admin.get("/session/:id", (ctx) => {
  const id = +ctx.params.id;
  const sess = fetchSession.one(id);
  if (!sess) {
    ctx.response.status = 404;
  } else {
    const [game, inline_message_id, chat_id, message_id] = sess;
    const ret: {
      game: string;
      inline_message_id?: string;
      chat_id?: number;
      message_id?: number;
    } = { game, inline_message_id, chat_id, message_id };
    ctx.response.body = ret;
    ctx.response.status = 200;
  }
});

admin.get("/session/:id/:user", async (ctx) => {
  const id = +ctx.params.id;
  const user_id = +ctx.params.user;
  const sess = fetchSession.one(id);
  if (!sess) {
    ctx.response.status = 404;
  } else {
    const [, inline_message_id, chat_id, message_id] = sess;
    try {
      const highscores = await bot.api.raw.getGameHighScores({
        user_id,
        inline_message_id,
        chat_id,
        message_id,
      });
      ctx.response.body = highscores;
      ctx.response.status = 200;
    } catch {
      ctx.response.status = 404;
    }
  }
});

admin.get("/blocklist/:page", (ctx) => {
  const page = +ctx.params.page;
  const list: { user_id: number; desc: string }[] = [];
  for (const [user_id, desc] of listBlockList.query(page * 100)) {
    list.push({ user_id, desc });
  }
  ctx.response.body = list;
  ctx.response.status = 200;
});

admin.put("/block/:user", async (ctx) => {
  const user_id = +ctx.params.user;
  const desc = await ctx.request.body({ type: "text" }).value;
  addToBlockList.one(user_id, desc);
  for (
    const [, inline_message_id, chat_id, message_id] of querySessionForUser
      .query(user_id)
  ) {
    try {
      await bot.api.raw.setGameScore({
        user_id,
        inline_message_id,
        chat_id,
        message_id,
        score: 0,
        force: true,
      });
    } catch {}
  }
  ctx.response.status = 200;
});

admin.get("/log/:page", (ctx) => {
  const page = +ctx.params.page;
  const session = toNumber(ctx.request.url.searchParams.get("session_id"));
  const user = toNumber(ctx.request.url.searchParams.get("user_id"));
  const min_time = toNumber(ctx.request.url.searchParams.get("min_time"));
  const max_time = toNumber(ctx.request.url.searchParams.get("max_time"));
  const min_score = toNumber(ctx.request.url.searchParams.get("min_score"));
  const max_score = toNumber(ctx.request.url.searchParams.get("max_score"));
  const list: {
    session_id: number;
    time: number;
    user_id: number;
    score: number;
  }[] = [];
  for (
    const [session_id, time, user_id, score] of queryLog({
      page,
      session,
      user,
      min_time,
      max_time,
      min_score,
      max_score,
    })
  ) {
    list.push({ session_id, time, user_id, score });
  }
  ctx.response.body = list;
  ctx.response.status = 200;
});

export default admin;

function toNumber(str: string | null): number | undefined {
  if (str) {
    return +str;
  }
}
