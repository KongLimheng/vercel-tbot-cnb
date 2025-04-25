import { Context, Markup } from 'telegraf';
import createDebug from 'debug';
import axios from 'axios';
import { createTransport } from 'nodemailer';
import { BotContext, BotDocContext, UserState } from '../types';
const debug = createDebug('bot:text:message');

const inLineKeyBoard = Markup.keyboard([['/start']])
  .resize()
  .oneTime();

const replyWithStart = (ctx: Context, string: string) =>
  ctx.reply(string, inLineKeyBoard);

export const askEmailStep = async ({ ctx, userStates }: BotContext) => {
  const chatId = ctx.chat.id;
  const state = userStates.get(chatId);

  if (!state) {
    console.log('No state found for user, sending /start command.');
    ctx.deleteMessage(ctx.message.message_id);
    return replyWithStart(ctx, 'Please type /start to begin.');
  }

  const message = ctx.message;

  console.log(userStates, '=====> state');
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
    console.log('No state found for user, sending /start command.');
    ctx.deleteMessage(ctx.message.message_id);
    await ctx.reply('Please upload your file 📄(.csv, .xls, .xlsx only).');
  }
};

export const onDocument = async ({ ctx, userStates }: BotDocContext) => {
  const state = userStates.get(ctx.chat.id);
  if (!state) return replyWithStart(ctx, 'Please type /start to begin.');
  if (!state || state.step !== 'waitForAttachment') {
    return replyWithStart(ctx, 'Please follow the process using /start.');
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

    const fileData = await axios.get(fileLink.href, {
      responseType: 'arraybuffer',
    });

    if (state.email) await sendEmail(state.email, fileData.data, fileName);

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
  try {
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
  } catch (error) {
    debug('Error sending email:' + error);
  }
}
