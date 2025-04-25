import Redis from 'ioredis';
import { Context, MiddlewareFn } from 'telegraf';
import { BotContext, BotDocContext } from '../types';
import { Update } from 'telegraf/typings/core/types/typegram';

interface RateLimitState {
  lastAction: number;
  strikeCount: number;
}

export interface RateLimitInfo {
  isLimited: boolean;
  remainingMs?: number;
  strikeCount?: number;
}

export interface IRateLimiter {
  get(chatId: number): Promise<RateLimitInfo>;
  strike(chatId: number): Promise<void>;
  reset(chatId: number): Promise<void>;
}

const userRateLimit = new Map<number, RateLimitState>();

const BASE_COOLDOWN = 2000; // 2 seconds
const MAX_COOLDOWN = 60000; // 1 minute
const STRIKE_RESET_MS = 10 * 60 * 1000; // 10 minutes

export async function sendLiveCooldown(ctx: any, remainingMs: number) {
  const seconds = Math.ceil(remainingMs / 1000);
  let message = await ctx.reply(
    `⏳ You're going too fast. Please wait ${seconds}s.`,
  );

  const chatId = ctx.chat.id;
  const messageId = message.message_id;

  for (let i = seconds - 1; i >= 1; i--) {
    await new Promise((r) => setTimeout(r, 1000));
    await ctx.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      `⏳ You're going too fast. Please wait ${i}s.`,
    );
  }

  await new Promise((r) => setTimeout(r, 1000));
  await ctx.telegram.editMessageText(
    chatId,
    messageId,
    undefined,
    `✅ You can now continue!`,
  );

  // Auto-delete cooldown message after a few seconds
  setTimeout(() => {
    ctx.telegram.deleteMessage(chatId, messageId).catch(() => {});
  }, 5000);
}

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function getCoolDown(strikes: number): number {
  return Math.min(BASE_COOLDOWN * Math.pow(2, strikes), MAX_COOLDOWN);
}

export function getRateLimitInfo(chatId: number) {
  const now = Date.now();
  const state = userRateLimit.get(chatId);
  console.log(state, '=====> state rate');
  if (!state) return { isLimited: false };

  const coolDown = getCoolDown(state.strikeCount);
  const elapsed = now - state.lastAction;
  console.log(coolDown, '====', elapsed);
  if (elapsed < coolDown) {
    const remainingMs = coolDown - elapsed;
    return {
      isLimited: true,
      remainingMs,
      strikeCount: state.strikeCount,
    };
  }

  return { isLimited: false };
}

export function registerRateLimitStrike(chatId: number) {
  const now = Date.now();
  const state = userRateLimit.get(chatId);

  if (!state) {
    userRateLimit.set(chatId, { lastAction: now, strikeCount: 1 });
  } else {
    userRateLimit.set(chatId, {
      lastAction: now,
      strikeCount: state.strikeCount + 1,
    });
  }
}

export function resetRateLimit(chatId: number) {
  userRateLimit.set(chatId, { lastAction: Date.now(), strikeCount: 0 });
}

export class InMemoryRateLimiter implements IRateLimiter {
  private userMap = new Map<number, RateLimitState>();

  async get(chatId: number): Promise<RateLimitInfo> {
    // const now = Date.now();
    // const state = userRateLimit.get(chatId);
    // console.log(state, '=====> state rate');
    // if (!state) return { isLimited: false };

    // const coolDown = getCoolDown(state.strikeCount);
    // const elapsed = now - state.lastAction;
    // console.log(coolDown, '====', elapsed);
    // if (elapsed < coolDown) {
    //   const remainingMs = coolDown - elapsed;
    //   return {
    //     isLimited: true,
    //     remainingMs,
    //     strikeCount: state.strikeCount,
    //   };
    // }

    // return { isLimited: false };
    const now = Date.now();
    const state = this.userMap.get(chatId);

    if (!state) return { isLimited: false };
    if (now - state.lastAction > STRIKE_RESET_MS) {
      this.userMap.set(chatId, { lastAction: now, strikeCount: 0 });
      return { isLimited: false };
    }

    const cooldown = getCoolDown(state.strikeCount);
    const elapsed = now - state.lastAction;

    if (elapsed < cooldown) {
      return {
        isLimited: true,
        remainingMs: cooldown - elapsed,
        strikeCount: state.strikeCount,
      };
    }

    return { isLimited: false };
  }
  async strike(chatId: number): Promise<void> {
    const now = Date.now();
    const current = this.userMap.get(chatId);
    const strikeCount = current ? current.strikeCount + 1 : 1;
    this.userMap.set(chatId, { lastAction: now, strikeCount });
  }
  async reset(chatId: number): Promise<void> {
    this.userMap.set(chatId, { lastAction: Date.now(), strikeCount: 0 });
  }
}

export class RedisRateLimiter implements IRateLimiter {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  private key(chatId: number) {
    return `rate:cooldown:${chatId}`;
  }

  async get(chatId: number): Promise<RateLimitInfo> {
    const key = this.key(chatId);
    const [lastActionStr, strikesStr] = await this.redis.hmget(
      key,
      'last',
      'strikes',
    );
    const now = Date.now();

    if (!lastActionStr) return { isLimited: false };

    const lastAction = parseInt(lastActionStr, 10);
    const strikeCount = parseInt(strikesStr!, 10) || 0;

    if (now - lastAction > STRIKE_RESET_MS) {
      await this.redis.hmset(key, { last: now, strikes: 0 });
      return { isLimited: false };
    }

    const cooldown = getCoolDown(strikeCount);
    const elapsed = now - lastAction;

    if (elapsed < cooldown) {
      return { isLimited: true, remainingMs: cooldown - elapsed, strikeCount };
    }

    return { isLimited: false };
  }

  async strike(chatId: number) {
    const now = Date.now();
    const key = this.key(chatId);
    await this.redis.hset(key, 'last', now);
    await this.redis.hincrby(key, 'strikes', 1);
    await this.redis.expire(key, Math.ceil(STRIKE_RESET_MS / 1000));
  }

  async reset(chatId: number) {
    const now = Date.now();
    const key = this.key(chatId);
    await this.redis.hmset(key, { last: now, strikes: 0 });
  }
}

export const createRateLimiter = async (): Promise<IRateLimiter> => {
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    await redis.ping(); // Check if Redis is available
    return new RedisRateLimiter(redis);
  } catch (error) {
    console.warn('⚠️ Redis unavailable, using in-memory rate limiter.');
    return new InMemoryRateLimiter();
  }
};
