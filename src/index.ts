import { config } from 'dotenv';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { development, production } from './core';
import { askEmailStep, onDocument } from './text';
import { UserState } from './types';
import { VercelRequest, VercelResponse } from '@vercel/node';

config();
// Load environment variables from .env file

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';

const bot = new Telegraf(BOT_TOKEN);
const userStates = new Map<number, UserState>();

bot.start(async (ctx) => {
  userStates.set(ctx.chat.id, { step: 'askEmail' });

  await ctx.sendChatAction('typing');
  ctx.reply(
    `Hello 🤚, ${ctx.message.from.first_name} ${ctx.message.from.last_name}!
      \n\nPlease enter your email address ✉️...`,
  );
});
// bot.command('start', (ctx) => ctx.scene.enter('botWizard'));

bot.on(message('text'), async (ctx) => await askEmailStep({ ctx, userStates }));
bot.on(
  message('document'),
  async (ctx) => await onDocument({ ctx, userStates }),
);

bot.on(message('photo'), async (ctx) => {
  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.reply(
    '❌ Image uploads are not allowed. Please upload only .csv, .xls, or .xlsx are allowed.',
  );
});

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

//dev mode
ENVIRONMENT !== 'production' && development(bot);
