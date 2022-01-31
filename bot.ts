import { Bot } from "https://deno.land/x/grammy@v1.6.2/mod.ts";
import { config, secret } from "./config.ts";

const bot = new Bot(secret.token);

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
  url.searchParams.append("user_id", "" + ctx.from.id);
  url.searchParams.append("game", ctx.callbackQuery.game_short_name);
  if (ctx.inlineMessageId) {
    url.searchParams.append("inline_id", "" + ctx.inlineMessageId);
  } else if (ctx.message) {
    url.searchParams.append("chat_id", "" + ctx.message.chat.id);
    url.searchParams.append("message_id", "" + ctx.message.message_id);
  }
  await ctx.answerCallbackQuery({ url: url.toString() });
});

export default bot;
