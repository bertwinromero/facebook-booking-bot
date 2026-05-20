import type { FacebookChange } from '../types/index.js';
import { config } from '../config/env.js';
import * as facebook from '../services/facebook.service.js';
import * as ai from '../services/ai.service.js';

// Keywords that suggest booking intent
const BOOKING_KEYWORDS = [
  'book',
  'schedule',
  'appointment',
  'consultation',
  'meeting',
  'available',
  'availability',
  'slot',
  'time',
  'when',
  'price',
  'cost',
  'how much',
  'rate',
  'interested',
  'sign up',
  'register',
];

export async function handleComment(change: FacebookChange): Promise<void> {
  const { value } = change;

  // Only handle new comments (not edits or deletes)
  if (value.verb !== 'add') {
    return;
  }

  // Ignore comments from our own page
  if (value.from.id === config.facebook.pageId) {
    return;
  }

  // Ignore replies to other comments (only handle top-level comments)
  if (value.parent_id && value.parent_id !== value.post_id) {
    return;
  }

  const commentId = value.comment_id;
  const commentText = value.message;
  const commenterName = value.from.name;

  if (!commentId || !commentText) {
    return;
  }

  console.log(`Processing comment from ${commenterName}: ${commentText}`);

  try {
    // Check if comment shows booking intent
    const hasBookingIntent = detectBookingIntent(commentText);

    if (hasBookingIntent) {
      // Reply publicly with a helpful response
      const publicReply = await generatePublicReply(commentText, commenterName);
      await facebook.replyToComment(commentId, publicReply);

      // Send a private message to start booking flow
      try {
        await facebook.sendPrivateReply(
          commentId,
          `Hey ${commenterName}! Saw your comment 👋 Send me a message and I can help you out!`
        );
      } catch (error) {
        // Private reply might fail if user hasn't interacted with page before
        console.log('Could not send private reply (user may not have interacted with page)');
      }
    } else {
      // For general comments, optionally reply if it's a question
      if (isQuestion(commentText)) {
        const publicReply = await generatePublicReply(commentText, commenterName);
        await facebook.replyToComment(commentId, publicReply);
      }
    }
  } catch (error) {
    console.error('Error handling comment:', error);
  }
}

function detectBookingIntent(text: string): boolean {
  const lowerText = text.toLowerCase();

  return BOOKING_KEYWORDS.some((keyword) => lowerText.includes(keyword));
}

function isQuestion(text: string): boolean {
  // Simple heuristic: check for question marks or question words
  const questionWords = ['what', 'when', 'where', 'how', 'why', 'who', 'which', 'can', 'do', 'does', 'is', 'are'];
  const lowerText = text.toLowerCase();

  if (text.includes('?')) {
    return true;
  }

  return questionWords.some((word) => lowerText.startsWith(word) || lowerText.includes(` ${word} `));
}

async function generatePublicReply(
  commentText: string,
  commenterName: string
): Promise<string> {
  // Use AI to generate a contextual reply
  try {
    const aiResponse = await ai.generateResponse(
      commentText,
      [],
      'IDLE',
      {},
      undefined
    );

    // Keep public replies short and invite to DM for booking
    let reply = aiResponse.text;

    // If the response is too long, truncate it
    if (reply.length > 200) {
      reply = reply.substring(0, 197) + '...';
    }

    // Add a DM invitation if booking-related
    if (detectBookingIntent(commentText)) {
      reply += ' Send us a message to book! 📩';
    }

    return `Hi ${commenterName}! ${reply}`;
  } catch (error) {
    console.error('Error generating AI reply for comment:', error);

    // Fallback response
    if (detectBookingIntent(commentText)) {
      return `Hey ${commenterName}! DM us and I'll help you out 😊`;
    }

    return `Hi ${commenterName}! Thanks for reaching out. Feel free to send us a message if you have any questions!`;
  }
}
