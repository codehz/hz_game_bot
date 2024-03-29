import { Bot } from "https://deno.land/x/grammy@v1.6.2/mod.ts";
import { config, secret } from "./config.ts";
import { encode } from "./jwt.ts";

const bot = new Bot(secret.token, {
  client: {
    apiRoot: config.api ?? "https://api.telegram.org",
  },
});

bot.on("inline_query", (ctx) => {
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
});

bot.on("callback_query:game_short_name", async (ctx) => {
  const url = new URL(config.base);
  const obj = {
    game: ctx.callbackQuery.game_short_name,
    user_id: ctx.from.id,
    inline_message_id: ctx.inlineMessageId,
    chat_id: ctx.message?.chat.id,
    message_id: ctx.message?.message_id,
  };
  url.searchParams.append("data", await encode(obj));
  await ctx.answerCallbackQuery({ url: url.toString() });
});

export default bot;
