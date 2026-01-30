import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Required
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key is required'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  TELEGRAM_CHAT_ID: z.string().min(1, 'Telegram chat ID is required'),
  
  // Trading parameters
  SYMBOLS: z.string().default('BTCUSD-PERP'),
  MIN_PROBABILITY: z.coerce.number().min(0).max(100).default(65),
  MIN_RISK_REWARD: z.coerce.number().min(1).default(2.5),
  
  // Monitoring
  CHECK_INTERVAL_SECONDS: z.coerce.number().min(10).default(30),
  MAX_FOLLOWUPS_PER_SIGNAL: z.coerce.number().min(1).max(5).default(3),
  
  // Pre-filters (trigger Claude call)
  PREFILTER_MIN_VOLATILITY: z.coerce.number().min(0).max(1).default(0.015), // 1.5%
  PREFILTER_MIN_VOLUME_SPIKE: z.coerce.number().min(1).default(2.0), // 2x average
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse(process.env);
