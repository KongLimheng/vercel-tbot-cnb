// src/rateLimit.ts
const userTimestamps = new Map<number, number>();

export function rateLimit(seconds: number) {
  return (ctx: any, next: () => Promise<void>) => {
    const userId = ctx.from?.id;
    const now = Date.now();

    if (userId) {
      const lastTime = userTimestamps.get(userId) || 0;
      if (now - lastTime < seconds * 1000) {
        return ctx.reply(
          `⏳ Please wait ${Math.ceil((seconds * 1000 - (now - lastTime)) / 1000)}s before trying again.`,
        );
      }
      userTimestamps.set(userId, now);
    }

    return next();
  };
}

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
