import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  // Server
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),

  // Facebook
  facebook: {
    appId: requireEnv('FB_APP_ID'),
    appSecret: requireEnv('FB_APP_SECRET'),
    pageAccessToken: requireEnv('FB_PAGE_ACCESS_TOKEN'),
    verifyToken: requireEnv('FB_VERIFY_TOKEN'),
    pageId: requireEnv('FB_PAGE_ID'),
    apiVersion: 'v25.0',
  },

  // AI Provider (openai or anthropic)
  ai: {
    provider: optionalEnv('AI_PROVIDER', 'openai') as 'openai' | 'anthropic',
    openaiApiKey: optionalEnv('OPENAI_API_KEY', ''),
    openaiModel: optionalEnv('OPENAI_MODEL', 'gpt-4o-mini'),
    anthropicApiKey: optionalEnv('ANTHROPIC_API_KEY', ''),
    anthropicModel: optionalEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
  },

  // Cal.com (optional - set CALCOM_ENABLED=true to use)
  calcom: {
    enabled: optionalEnv('CALCOM_ENABLED', 'false') === 'true',
    apiKey: optionalEnv('CALCOM_API_KEY', ''),
    eventTypeId: parseInt(optionalEnv('CALCOM_EVENT_TYPE_ID', '1'), 10),
    baseUrl: 'https://api.cal.com/v1',
  },

  // Database
  database: {
    url: requireEnv('DATABASE_URL'),
  },

  // Redis
  redis: {
    url: optionalEnv('REDIS_URL', ''),
  },

  // Business
  business: {
    name: optionalEnv('BUSINESS_NAME', 'Our Business'),
    timezone: optionalEnv('BUSINESS_TIMEZONE', 'America/New_York'),
  },
} as const;

export type Config = typeof config;
