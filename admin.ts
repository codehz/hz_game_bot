import { Router } from "https://deno.land/x/oak@v10.2.0/mod.ts";
import { decode } from "./jwt.ts";
import {
  addToBlockList,
  fetchSession,
  isAdmin,
  listBlockList,
  listLog,
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
  const sess = fetchSession.one(+ctx.params.id);
  if (!sess) {
    ctx.response.status = 404;
  } else {
    const [game, inline_message_id, chat_id, message_id] = sess;
    const ret: {
      game: string;
      inline_message_id?: string;
      chat_id?: number;
      message_id?: number;
      logs: {
        time: number;
        user_id: number;
        score: number;
      }[];
    } = { game, inline_message_id, chat_id, message_id, logs: [] };
    for (const [, time, user_id, score] of queryLog.query(id)) {
      ret.logs.push({ time, user_id, score });
    }
    ctx.response.body = ret;
    ctx.response.status = 200;
  }
});

admin.get("/blocklist", (ctx) => {
  const list: { user_id: number; desc: string }[] = [];
  for (const [user_id, desc] of listBlockList.query()) {
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
  const list: {
    session_id: number;
    time: number;
    user_id: number;
    score: number;
  }[] = [];
  for (const [session_id, time, user_id, score] of listLog.query(page)) {
    list.push({ session_id, time, user_id, score });
  }
  ctx.response.body = list;
  ctx.response.status = 200;
});

export default admin;
