import { config } from '../config/env.js';
import type { QuickReply, Button } from '../types/index.js';

const { facebook } = config;
const graphUrl = `https://graph.facebook.com/${facebook.apiVersion}`;

interface SendMessageResponse {
  recipient_id: string;
  message_id: string;
}

export async function sendTextMessage(
  recipientId: string,
  text: string
): Promise<SendMessageResponse> {
  return sendMessage(recipientId, { text });
}

export async function sendQuickReplies(
  recipientId: string,
  text: string,
  quickReplies: QuickReply[]
): Promise<SendMessageResponse> {
  return sendMessage(recipientId, {
    text,
    quick_replies: quickReplies,
  });
}

export async function sendButtonTemplate(
  recipientId: string,
  text: string,
  buttons: Button[]
): Promise<SendMessageResponse> {
  return sendMessage(recipientId, {
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text,
        buttons,
      },
    },
  });
}

async function sendMessage(
  recipientId: string,
  message: Record<string, unknown>
): Promise<SendMessageResponse> {
  const url = `${graphUrl}/${facebook.pageId}/messages`;

  const body = {
    recipient: { id: recipientId },
    message,
    messaging_type: 'RESPONSE',
    access_token: facebook.pageAccessToken,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Facebook Send API error:', errorData);
      throw new Error(`Facebook API error: ${response.status}`);
    }

    return await response.json() as SendMessageResponse;
  } catch (error) {
    console.error('Failed to send Facebook message:', error);
    throw error;
  }
}

export async function replyToComment(
  commentId: string,
  message: string
): Promise<{ id: string }> {
  const url = `${graphUrl}/${commentId}/comments`;

  const body = {
    message,
    access_token: facebook.pageAccessToken,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Facebook Comment API error:', errorData);
      throw new Error(`Facebook API error: ${response.status}`);
    }

    return await response.json() as { id: string };
  } catch (error) {
    console.error('Failed to reply to comment:', error);
    throw error;
  }
}

export async function sendPrivateReply(
  commentId: string,
  message: string
): Promise<SendMessageResponse> {
  // Private replies allow sending a one-time message to a commenter
  const url = `${graphUrl}/${facebook.pageId}/messages`;

  const body = {
    recipient: { comment_id: commentId },
    message: { text: message },
    messaging_type: 'RESPONSE',
    access_token: facebook.pageAccessToken,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Facebook Private Reply error:', errorData);
      throw new Error(`Facebook API error: ${response.status}`);
    }

    return await response.json() as SendMessageResponse;
  } catch (error) {
    console.error('Failed to send private reply:', error);
    throw error;
  }
}

export async function markSeen(recipientId: string): Promise<void> {
  const url = `${graphUrl}/${facebook.pageId}/messages`;

  const body = {
    recipient: { id: recipientId },
    sender_action: 'mark_seen',
    access_token: facebook.pageAccessToken,
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // Non-critical, just log
    console.error('Failed to mark seen:', error);
  }
}

export async function typingOn(recipientId: string): Promise<void> {
  const url = `${graphUrl}/${facebook.pageId}/messages`;

  const body = {
    recipient: { id: recipientId },
    sender_action: 'typing_on',
    access_token: facebook.pageAccessToken,
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('Failed to set typing indicator:', error);
  }
}

export async function typingOff(recipientId: string): Promise<void> {
  const url = `${graphUrl}/${facebook.pageId}/messages`;

  const body = {
    recipient: { id: recipientId },
    sender_action: 'typing_off',
    access_token: facebook.pageAccessToken,
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('Failed to turn off typing indicator:', error);
  }
}

export function createServiceQuickReplies(): QuickReply[] {
  return [
    {
      content_type: 'text',
      title: '30 min consultation',
      payload: 'SERVICE_30MIN',
    },
    {
      content_type: 'text',
      title: '60 min consultation',
      payload: 'SERVICE_60MIN',
    },
  ];
}

export function createConfirmationQuickReplies(): QuickReply[] {
  return [
    {
      content_type: 'text',
      title: 'Yes, confirm',
      payload: 'CONFIRM_YES',
    },
    {
      content_type: 'text',
      title: 'No, start over',
      payload: 'CONFIRM_NO',
    },
  ];
}
