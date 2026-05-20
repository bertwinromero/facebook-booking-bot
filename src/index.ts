import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import { config } from './config/env.js';
import { facebookWebhookRoutes } from './webhooks/facebook.js';
import { healthCheck, resetStaleConversations, cleanupOldMessages } from './db/client.js';

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
  },
});

// Store raw body for signature verification
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (req, body, done) => {
    try {
      (req as unknown as { rawBody: string }).rawBody = body as string;
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
);

// Register plugins
await fastify.register(formbody);

// Health check endpoint
fastify.get('/health', async (_request, reply) => {
  const dbResult = await healthCheck();

  if (dbResult.connected) {
    return reply.send({ status: 'healthy', database: 'connected' });
  }

  return reply.status(503).send({
    status: 'unhealthy',
    database: 'disconnected',
    error: dbResult.error
  });
});

// Root endpoint
fastify.get('/', async (_request, reply) => {
  return reply.send({
    name: 'Facebook Booking Bot',
    version: '1.0.0',
    status: 'running',
  });
});

// Register webhook routes
await fastify.register(facebookWebhookRoutes);

// Periodic cleanup tasks
function startPeriodicTasks(): void {
  // Reset stale conversations every 5 minutes
  setInterval(async () => {
    try {
      await resetStaleConversations();
    } catch (error) {
      fastify.log.error({ err: error }, 'Error resetting stale conversations');
    }
  }, 5 * 60 * 1000);

  // Cleanup old messages every hour
  setInterval(async () => {
    try {
      await cleanupOldMessages();
    } catch (error) {
      fastify.log.error({ err: error }, 'Error cleaning up old messages');
    }
  }, 60 * 60 * 1000);
}

// Start server
async function start(): Promise<void> {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Server running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);

    startPeriodicTasks();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await fastify.close();
  process.exit(0);
});

start();
