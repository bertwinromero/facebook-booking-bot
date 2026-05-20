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
    if (config.ai.provider === 'openai') {
      return await generateWithOpenAI(userMessage, conversationHistory, systemPrompt);
    } else {
      return await generateWithAnthropic(userMessage, conversationHistory, systemPrompt);
    }
  } catch (error) {
    console.error('AI Service Error:', error);
    return {
      text: "I'm having trouble processing your request right now. Could you try again in a moment?",
      intent: 'GENERAL',
    };
  }
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

    if (!parsed.text || !parsed.intent) {
      return {
        text: parsed.text || text.trim(),
        intent: parsed.intent || 'GENERAL',
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
      intent: parsed.intent,
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
