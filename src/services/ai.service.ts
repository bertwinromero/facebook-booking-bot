import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { getSystemPrompt } from '../prompts/booking-assistant.js';
import type {
  AIResponse,
  ConversationState,
  StateData,
  Message,
  AvailabilitySlot,
} from '../types/index.js';

// Initialize clients lazily
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.ai.openaiApiKey,
    });
  }
  return openaiClient;
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: config.ai.anthropicApiKey,
    });
  }
  return anthropicClient;
}

export async function generateResponse(
  userMessage: string,
  conversationHistory: Message[],
  state: ConversationState,
  stateData: StateData,
  availableSlots?: AvailabilitySlot[]
): Promise<AIResponse> {
  const systemPrompt = getSystemPrompt(state, stateData, availableSlots, userMessage);

  try {
    let response: AIResponse;
    if (config.ai.provider === 'openai') {
      response = await generateWithOpenAI(userMessage, conversationHistory, systemPrompt);
    } else {
      response = await generateWithAnthropic(userMessage, conversationHistory, systemPrompt);
    }

    // Apply state-aware intent correction (AI often gets this wrong)
    response = correctIntentForState(response, state, userMessage);

    return response;
  } catch (error) {
    console.error('AI Service Error:', error);
    return {
      text: "I'm having trouble processing your request right now. Could you try again in a moment?",
      intent: 'GENERAL',
    };
  }
}

/**
 * Corrects AI intent based on conversation state.
 * The AI often ignores the current state and returns wrong intents.
 * This function enforces state-based intent rules on the server side.
 */
function correctIntentForState(
  response: AIResponse,
  state: ConversationState,
  userMessage: string
): AIResponse {
  const lowerMessage = userMessage.toLowerCase().trim();

  // In COLLECTING_NAME state: if user provides text (not a question), it's their name
  if (state === 'COLLECTING_NAME') {
    // Check if it's NOT a question or command
    const isQuestion = lowerMessage.includes('?') ||
                       lowerMessage.startsWith('what') ||
                       lowerMessage.startsWith('how') ||
                       lowerMessage.startsWith('why') ||
                       lowerMessage.startsWith('can');
    const isCancel = lowerMessage.includes('cancel') || lowerMessage.includes('stop');

    if (!isQuestion && !isCancel && response.intent !== 'PROVIDE_INFO') {
      console.log(`State correction: In COLLECTING_NAME, changing intent from ${response.intent} to PROVIDE_INFO`);
      return {
        ...response,
        intent: 'PROVIDE_INFO',
        extractedData: {
          ...response.extractedData,
          name: userMessage.trim(), // Use the raw message as the name
        },
      };
    }
  }

  // In COLLECTING_EMAIL state: if user provides text with @, it's their email
  if (state === 'COLLECTING_EMAIL') {
    const hasEmail = lowerMessage.includes('@');
    const isCancel = lowerMessage.includes('cancel') || lowerMessage.includes('stop');

    if (hasEmail && !isCancel && response.intent !== 'PROVIDE_INFO') {
      // Extract email from the message
      const emailMatch = userMessage.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      if (emailMatch) {
        console.log(`State correction: In COLLECTING_EMAIL, changing intent from ${response.intent} to PROVIDE_INFO`);
        return {
          ...response,
          intent: 'PROVIDE_INFO',
          extractedData: {
            ...response.extractedData,
            email: emailMatch[0].toLowerCase(),
          },
        };
      }
    }
  }

  // In CONFIRMING state: "yes" should be CONFIRM_BOOKING
  if (state === 'CONFIRMING') {
    const isYes = lowerMessage === 'yes' ||
                  lowerMessage === 'yep' ||
                  lowerMessage === 'yeah' ||
                  lowerMessage === 'confirm' ||
                  lowerMessage.includes('looks good') ||
                  lowerMessage.includes('yes please');

    if (isYes && response.intent !== 'CONFIRM_BOOKING') {
      console.log(`State correction: In CONFIRMING, changing intent from ${response.intent} to CONFIRM_BOOKING`);
      return {
        ...response,
        intent: 'CONFIRM_BOOKING',
      };
    }
  }

  return response;
}

async function generateWithOpenAI(
  userMessage: string,
  conversationHistory: Message[],
  systemPrompt: string
): Promise<AIResponse> {
  const openai = getOpenAI();

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: config.ai.openaiModel,
    messages,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  return parseAIResponse(content);
}

async function generateWithAnthropic(
  userMessage: string,
  conversationHistory: Message[],
  systemPrompt: string
): Promise<AIResponse> {
  const anthropic = getAnthropic();

  const messages: Anthropic.MessageParam[] = conversationHistory.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  messages.push({
    role: 'user',
    content: userMessage,
  });

  const response = await anthropic.messages.create({
    model: config.ai.anthropicModel,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return parseAIResponse(content.text);
}

function parseAIResponse(text: string): AIResponse {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        text: text.trim(),
        intent: 'GENERAL',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate intent - fall back to GENERAL if invalid
    let intent: AIResponse['intent'] = 'GENERAL';
    if (parsed.intent && isValidIntent(parsed.intent)) {
      intent = parsed.intent;
    } else if (parsed.intent) {
      console.warn(`Invalid intent received: "${parsed.intent}", falling back to GENERAL`);
    }

    if (!parsed.text) {
      return {
        text: text.trim(),
        intent,
      };
    }

    const extractedData: AIResponse['extractedData'] = {};

    if (parsed.extractedData) {
      if (parsed.extractedData.service && ['30min', '60min'].includes(parsed.extractedData.service)) {
        extractedData.service = parsed.extractedData.service;
      }
      if (parsed.extractedData.preferredDate) {
        extractedData.preferredDate = parsed.extractedData.preferredDate;
      }
      if (parsed.extractedData.selectedTime) {
        extractedData.selectedTime = parsed.extractedData.selectedTime;
      }
      if (parsed.extractedData.name && typeof parsed.extractedData.name === 'string') {
        extractedData.name = parsed.extractedData.name.trim();
      }
      if (parsed.extractedData.email && isValidEmail(parsed.extractedData.email)) {
        extractedData.email = parsed.extractedData.email.trim().toLowerCase();
      }
    }

    return {
      text: parsed.text,
      intent,
      extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined,
      showAvailability: parsed.showAvailability === true,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error, 'Raw text:', text);
    return {
      text: text.trim(),
      intent: 'GENERAL',
    };
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

const VALID_INTENTS = [
  'GENERAL',
  'BOOK',
  'SELECT_SERVICE',
  'SELECT_TIME',
  'PROVIDE_INFO',
  'CONFIRM_BOOKING',
  'RESCHEDULE',
  'CANCEL',
] as const;

function isValidIntent(intent: string): intent is AIResponse['intent'] {
  return VALID_INTENTS.includes(intent as typeof VALID_INTENTS[number]);
}

export function mapSlotSelectionToTime(
  selection: string,
  availableSlots: AvailabilitySlot[]
): string | null {
  const numberMatch = selection.match(/(\d+)/);
  if (numberMatch) {
    const index = parseInt(numberMatch[1], 10) - 1;
    if (index >= 0 && index < availableSlots.length) {
      return availableSlots[index].time;
    }
  }

  const ordinals = ['first', 'second', 'third', 'fourth', 'fifth'];
  const lowerSelection = selection.toLowerCase();
  for (let i = 0; i < ordinals.length; i++) {
    if (lowerSelection.includes(ordinals[i])) {
      if (i < availableSlots.length) {
        return availableSlots[i].time;
      }
    }
  }

  for (const slot of availableSlots) {
    if (selection.includes(slot.displayTime) || selection.includes(slot.time)) {
      return slot.time;
    }
  }

  return null;
}
