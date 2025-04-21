import { Context, NarrowedContext } from 'telegraf';
import createDebug from 'debug';
import { Message, Update } from 'telegraf/typings/core/types/typegram';
import axios from 'axios';
import { createTransport } from 'nodemailer';

const debug = createDebug('bot:text:message');

type TextMessageContext = NarrowedContext<
  Context<Update>,
  Update.MessageUpdate<Message.TextMessage>
>;

type DocumentMessageContext = NarrowedContext<
  Context<Update>,
  Update.MessageUpdate<Message.DocumentMessage>
>;

type BotContext = {
  ctx: TextMessageContext;
  userStates: Map<any, any>;
};

type BotDocContext = {
  ctx: DocumentMessageContext;
  userStates: Map<any, any>;
};

const replyToMessage = (ctx: Context, messageId: number, string: string) =>
  ctx.reply(string, {
    reply_parameters: { message_id: messageId },
  });

export const askEmailStep = async ({ ctx, userStates }: BotContext) => {
  const state = userStates.get(ctx.chat?.id);

  if (!state) {
    debug('No state found for user, sending /start command.');
    ctx.deleteMessage(ctx.message.message_id);
    return ctx.reply('Please type /start to begin.');
  }

  const message = ctx.message;
  if (state.step === 'askEmail') {
    const email = message.text.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!isValidEmail) {
      ctx.deleteMessage(message.message_id);
      return ctx.reply(
        '❌ That doesn’t look like a valid email address. Please enter a valid email (e.g. user@example.com).',
      );
    }

    state.email = email;

    state.step = 'waitForAttachment';
    await ctx.reply('Please upload your file 📄(.csv, .xls, .xlsx only).');
  } else {
    debug('No state found for user, sending /start command.');
    ctx.deleteMessage(ctx.message.message_id);
    await ctx.reply('Please upload your file 📄(.csv, .xls, .xlsx only).');
  }
};

export const onDocument = async ({ ctx, userStates }: BotDocContext) => {
  const state = userStates.get(ctx.chat.id);
  if (!state) return ctx.reply('Please type /start to begin.');
  if (!state || state.step !== 'waitForAttachment') {
    return ctx.reply('Please follow the process using /start.');
  }

  const file = ctx.message.document;
  const fileName = file.file_name?.toLowerCase() || '';

  // Validate file type
  const allowedExts = ['.csv', '.xls', '.xlsx'];
  const isValid = allowedExts.some((ext) => fileName?.endsWith(ext));

  if (!isValid) {
    ctx.deleteMessage(ctx.message.message_id);
    return ctx.reply(
      '❌ Invalid file type. Only 📄 .csv, .xls, or .xlsx are allowed.',
    );
  }

  try {
    await ctx.sendChatAction('typing');
    const waitText = await ctx.reply('please wait...');

    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    debug('After get document');

    const fileData = await axios.get(fileLink.href, {
      responseType: 'arraybuffer',
    });

    debug('After send Email');

    await sendEmail(state.email, fileData.data, fileName);

    ctx.deleteMessage(waitText.message_id);
    ctx.reply('✅ Your information and file have been sent via email!');

    console.log('=====> state', userStates);
    userStates.delete(ctx.chat.id);
  } catch (err) {
    ctx.reply('⚠️ Error downloading the file.');
    console.error(err);
    debug('Error downloading the file:', err);
  }
};

async function sendEmail(email: string, fileData: any, fileName: string) {
  const transporter = createTransport({
    service: 'gmail',
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Telegram Bot" <${process.env.SMTP_USER}>`,
    to: 'brosheng140@gmail.com',
    subject: '📎 New File Submission from Telegram Bot',
    text: `Email: ${email}`,
    attachments: [{ filename: fileName, content: fileData }],
  });
}
