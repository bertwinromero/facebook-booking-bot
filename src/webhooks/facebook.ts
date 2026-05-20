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

      console.log('Signature header:', signature);
      console.log('Raw body exists:', !!rawBody);
      console.log('Raw body length:', rawBody?.length);

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
      console.log('Webhook body:', JSON.stringify(body, null, 2));
      for (const entry of body.entry) {
        console.log('Processing entry:', entry.id);
        // Handle messaging events
        if (entry.messaging) {
          console.log('Found messaging events:', entry.messaging.length);
          for (const messagingEvent of entry.messaging) {
            processMessagingEvent(messagingEvent);
          }
        } else {
          console.log('No messaging in entry');
        }

        // Handle feed/comment events
        if (entry.changes) {
          console.log('Found changes:', entry.changes.length);
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
    console.log('Processing messaging event:', JSON.stringify(event, null, 2));
    try {
      // Skip echo messages (messages sent by our page)
      if ((event.message as { is_echo?: boolean })?.is_echo) {
        console.log('Skipping echo message');
        return;
      }

      // Handle message or postback
      if (event.message || event.postback) {
        console.log('Calling handleMessage...');
        await handleMessage(event);
        console.log('handleMessage completed');
      } else {
        console.log('No message or postback in event');
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
