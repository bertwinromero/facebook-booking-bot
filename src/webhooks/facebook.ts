import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/env.js';
import { verifyFacebookSignature } from '../utils/crypto.js';
import { handleMessage } from '../handlers/message.handler.js';
import { handleComment } from '../handlers/comment.handler.js';
import type { FacebookWebhookEvent, FacebookMessaging, FacebookChange } from '../types/index.js';

interface WebhookVerifyQuery {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
}

export async function facebookWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Webhook verification endpoint
  fastify.get<{ Querystring: WebhookVerifyQuery }>(
    '/webhook',
    async (request: FastifyRequest<{ Querystring: WebhookVerifyQuery }>, reply: FastifyReply) => {
      const mode = request.query['hub.mode'];
      const token = request.query['hub.verify_token'];
      const challenge = request.query['hub.challenge'];

      if (mode === 'subscribe' && token === config.facebook.verifyToken) {
        console.log('Webhook verified successfully');
        return reply.send(challenge);
      }

      console.warn('Webhook verification failed');
      return reply.status(403).send('Forbidden');
    }
  );

  // Webhook event receiver
  fastify.post(
    '/webhook',
    {
      config: {
        rawBody: true,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify signature
      const signature = request.headers['x-hub-signature-256'] as string | undefined;
      const rawBody = (request as unknown as { rawBody: string }).rawBody;

      if (!verifyFacebookSignature(signature, rawBody, config.facebook.appSecret)) {
        console.warn('Invalid webhook signature');
        return reply.status(401).send('Unauthorized');
      }

      const body = request.body as FacebookWebhookEvent;

      // Verify it's a page subscription
      if (body.object !== 'page') {
        return reply.status(404).send('Not Found');
      }

      // Process entries
      for (const entry of body.entry) {
        // Handle messaging events
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            processMessagingEvent(messagingEvent);
          }
        }

        // Handle feed/comment events
        if (entry.changes) {
          for (const change of entry.changes) {
            processChangeEvent(change);
          }
        }
      }

      // Always respond quickly to webhook
      return reply.send('EVENT_RECEIVED');
    }
  );
}

function processMessagingEvent(event: FacebookMessaging): void {
  // Process asynchronously to not block webhook response
  setImmediate(async () => {
    try {
      // Skip echo messages (messages sent by our page)
      if ((event.message as { is_echo?: boolean })?.is_echo) {
        return;
      }

      // Handle message or postback
      if (event.message || event.postback) {
        await handleMessage(event);
      }
    } catch (error) {
      console.error('Error processing messaging event:', error);
    }
  });
}

function processChangeEvent(change: FacebookChange): void {
  // Process asynchronously
  setImmediate(async () => {
    try {
      // Handle comment events
      if (change.field === 'feed' && change.value.item === 'comment') {
        await handleComment(change);
      }
    } catch (error) {
      console.error('Error processing change event:', error);
    }
  });
}
