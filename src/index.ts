import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { askEmailStep, onDocument } from './text';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import * as path from 'path';
import * as fs from 'fs';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';

const bot = new Telegraf(BOT_TOKEN);

const downloadDir = path.join('/tmp', 'downloads');
const userStates = new Map();

// Check and create downloads directory if not exist
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

bot.start(async (ctx) => {
  userStates.clear();
  userStates.set(ctx.chat.id, { step: 'askEmail' });

  await ctx.sendChatAction('typing');
  ctx.reply(
    `Hello 🤚, ${ctx.message.from.first_name} ${ctx.message.from.last_name}! \n\nPlease enter your email address ✉️...`,
  );
});

bot.on(message('text'), async (ctx) => await askEmailStep({ ctx, userStates }));
bot.on(
  message('document'),
  async (ctx) =>
    await onDocument({ ctx, userStates, downloadPath: downloadDir }),
);

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

//dev mode
ENVIRONMENT !== 'production' && development(bot);
