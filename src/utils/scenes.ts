import { Scenes } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';

interface EmailWizardState {
  email?: string;
}

export const botWizard = new Scenes.WizardScene<
  Scenes.WizardContext<EmailWizardState>
>(
  'botWizard',
  async (ctx) => {
    await ctx.sendChatAction('typing');
    ctx.reply(
      `Hello 🤚, ${ctx.message?.from.first_name} ${ctx.message?.from.last_name}! 
    \n\nPlease enter your email address ✉️...`,
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    const message = ctx.message as Message.TextMessage;
    ctx.wizard.state.email = message.text.trim();
    const email = ctx.message?.text.trim() || '';
    // if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    //   await ctx.deleteMessage(ctx.message.message_id);
    //   return ctx.reply(
    //     '❌ That doesn’t look like a valid email address. Please enter a valid email (e.g. user@example.com).',
    //   );
    // }

    console.log(ctx.wizard.state);
    // await ctx.sendChatAction('typing');
    ctx.reply(
      `Thank you for providing your email address: .\n\nPlease upload a .csv, .xls, or .xlsx file.`,
    );
    return ctx.scene.leave();
  },
);
