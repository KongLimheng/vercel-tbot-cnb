import createDebug from 'debug';
import { Scenes, Telegraf } from 'telegraf';

const debug = createDebug('bot:dev');

const development = async (bot: Telegraf) => {
  const botInfo = (await bot.telegram.getMe()).username;

  debug('Bot runs in development mode');
  debug(`${botInfo} deleting webhook`);
  await bot.telegram.deleteWebhook();
  debug(`${botInfo} starting polling`);

  await bot.launch();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};

export { development };
