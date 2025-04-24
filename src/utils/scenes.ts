import { Context as TelegrafContext, Scenes } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import {
  WizardContext as BaseWizardContext,
  WizardScene,
  WizardSessionData,
} from 'telegraf/scenes';

interface MyWizardSession extends Scenes.WizardSessionData {
  email?: string;
}

export type MyWizardContext = Scenes.WizardContext<MyWizardSession> &
  TelegrafContext;

export const botWizard = new Scenes.WizardScene<MyWizardContext>(
  'botWizard',
  async (ctx) => {
    await ctx.sendChatAction('typing');
    ctx.reply(
      `Hello 🤚, ${ctx.message?.from.first_name} ${ctx.message?.from.last_name}!\n\nPlease enter your email address ✉️...`,
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    const message = ctx.message as Message.TextMessage;
    const email = message.text.trim() || '';
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!isValidEmail) {
      ctx.deleteMessage(message.message_id);
      return ctx.reply(
        '❌ That doesn’t look like a valid email address. Please enter a valid email (e.g. user@example.com).',
      );
    }
    console.log(ctx.wizard);
    // await ctx.sendChatAction('typing');
    ctx.reply(
      `Thank you for providing your email address: .\n\nPlease upload a .csv, .xls, or .xlsx file.`,
    );
    return ctx.scene.leave();
  },
);
