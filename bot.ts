import { Bot, InlineKeyboard } from "https://deno.land/x/grammy@v1.6.2/mod.ts";
import { addToUserCache, config, db, isAdmin, secret } from "./config.ts";
import { encode } from "./jwt.ts";
import { limit } from "https://deno.land/x/grammy_ratelimiter@v1.1.4/rateLimiter.ts";

const bot = new Bot(secret.token, {
  client: {
    apiRoot: config.api ?? "https://api.telegram.org",
  },
});

bot.use(limit());

bot.use((ctx, next) => {
  if (ctx.from) {
    addToUserCache(ctx.from);
  }

  return next();
});

bot.on("inline_query", (ctx) => {
  try {
    ctx.answerInlineQuery(
      config.games.map(({ id }) => ({
        type: "game",
        id,
        game_short_name: id,
      })),
      {
        cache_time: 600,
        is_personal: false,
      },
    );
  } catch {}
});

bot.on("callback_query:game_short_name", async (ctx) => {
  const url = new URL(config.base);
  const obj = {
    game: ctx.callbackQuery.game_short_name,
    user_id: ctx.from.id,
    inline_message_id: ctx.inlineMessageId,
    chat_id: ctx.message?.chat.id,
    message_id: ctx.message?.message_id,
    is_admin: isAdmin(ctx.from.id),
  };
  url.searchParams.append("data", await encode(obj));
  try {
    await ctx.answerCallbackQuery({ url: url.toString() });
  } catch {}
});

bot.command("start", async (ctx) => {
  if (ctx.from && isAdmin(ctx.from.id)) {
    const url = new URL(config.base);
    url.pathname = "admin.html";
    url.searchParams.append(
      "data",
      await encode({
        user_id: ctx.from.id,
        user_name: ctx.from.first_name,
      }, 60 * 60),
    );
    ctx.reply("Hello admin", {
      reply_markup: {
        inline_keyboard: new InlineKeyboard().url("admin page", url.toString())
          .inline_keyboard,
      },
    });
  } else {
    ctx.reply("Welcome to hz game bot (placeholder)");
  }
});

bot.command("stop", async (ctx) => {
  if (ctx.from && isAdmin(ctx.from.id)) {
    await bot.stop();
    db.execute("vacuum");
    db.close();
    Deno.exit(0);
  }
});

export default bot;
