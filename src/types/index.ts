import { Context, NarrowedContext } from 'telegraf';
import { Update, Message } from 'telegraf/typings/core/types/typegram';

export type UserState = {
  step: 'askEmail' | 'waitForAttachment';
  email?: string;
};

export type TextMessageContext = NarrowedContext<
  Context<Update>,
  Update.MessageUpdate<Message.TextMessage>
>;

export type DocumentMessageContext = NarrowedContext<
  Context<Update>,
  Update.MessageUpdate<Message.DocumentMessage>
>;

export type BotContext = {
  ctx: TextMessageContext;
  userStates: Map<number, UserState>;
};

export type BotDocContext = {
  ctx: DocumentMessageContext;
  userStates: Map<number, UserState>;
};
