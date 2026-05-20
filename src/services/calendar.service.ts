import { config } from '../config/env.js';
import type { AvailabilitySlot, CalBookingResponse } from '../types/index.js';

const { calcom } = config;

interface CalAvailabilityResponse {
  busy: Array<{ start: string; end: string }>;
  timeZone: string;
  dateRanges: Array<{ start: string; end: string }>;
  slots: Record<string, Array<{ time: string }>>;
}

// Generate mock availability slots for testing
function generateMockSlots(): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const now = new Date();

  // Generate slots for the next 5 days
  for (let day = 1; day <= 5; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // Add 9 AM and 2 PM slots
    for (const hour of [9, 14]) {
      const slotDate = new Date(date);
      slotDate.setHours(hour, 0, 0, 0);

      slots.push({
        time: slotDate.toISOString(),
        displayTime: formatSlotTime(slotDate.toISOString()),
      });
    }
  }

  return slots.slice(0, 5);
}

export async function getAvailability(
  days: number = 7
): Promise<AvailabilitySlot[]> {
  // Return mock slots if Cal.com is not enabled
  if (!calcom.enabled) {
    console.log('Cal.com not enabled, returning mock availability');
    return generateMockSlots();
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const url = new URL(`${calcom.baseUrl}/availability`);
  url.searchParams.set('apiKey', calcom.apiKey);
  url.searchParams.set('eventTypeId', calcom.eventTypeId.toString());
  url.searchParams.set('startTime', `${startStr}T00:00:00Z`);
  url.searchParams.set('endTime', `${endStr}T23:59:59Z`);
  url.searchParams.set('timeZone', config.business.timezone);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cal.com availability error:', errorText);
      throw new Error(`Cal.com API error: ${response.status}`);
    }

    const data = await response.json() as CalAvailabilityResponse;

    const slots: AvailabilitySlot[] = [];

    if (data.slots) {
      for (const [_date, daySlots] of Object.entries(data.slots)) {
        for (const slot of daySlots) {
          slots.push({
            time: slot.time,
            displayTime: formatSlotTime(slot.time),
          });
        }
      }
    }

    slots.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return slots.slice(0, 10);
  } catch (error) {
    console.error('Failed to fetch availability:', error);
    throw error;
  }
}

export async function createBooking(
  startTime: string,
  name: string,
  email: string,
  notes?: string
): Promise<CalBookingResponse> {
  // Return mock booking if Cal.com is not enabled
  if (!calcom.enabled) {
    console.log('Cal.com not enabled, creating mock booking');
    const mockId = Math.floor(Math.random() * 100000);
    return {
      id: mockId,
      uid: `mock-${mockId}-${Date.now()}`,
      title: '30 min Consultation',
      startTime: startTime,
      endTime: new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString(),
      status: 'ACCEPTED',
    };
  }

  const url = `${calcom.baseUrl}/bookings?apiKey=${calcom.apiKey}`;

  const body = {
    eventTypeId: calcom.eventTypeId,
    start: startTime,
    responses: {
      name,
      email,
      notes: notes || '',
    },
    timeZone: config.business.timezone,
    language: 'en',
    metadata: {
      source: 'facebook-messenger-bot',
    },
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
      const errorText = await response.text();
      console.error('Cal.com booking error:', errorText);
      throw new Error(`Cal.com booking failed: ${response.status}`);
    }

    const booking = await response.json() as CalBookingResponse;
    return booking;
  } catch (error) {
    console.error('Failed to create booking:', error);
    throw error;
  }
}

export async function cancelBooking(bookingUid: string): Promise<boolean> {
  if (!calcom.enabled) {
    console.log('Cal.com not enabled, mock cancelling booking:', bookingUid);
    return true;
  }

  const url = `${calcom.baseUrl}/bookings/${bookingUid}/cancel?apiKey=${calcom.apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cal.com cancel error:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to cancel booking:', error);
    return false;
  }
}

export async function getBooking(bookingUid: string): Promise<CalBookingResponse | null> {
  if (!calcom.enabled) {
    return null;
  }

  const url = `${calcom.baseUrl}/bookings/${bookingUid}?apiKey=${calcom.apiKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return await response.json() as CalBookingResponse;
  } catch (error) {
    console.error('Failed to get booking:', error);
    return null;
  }
}

function formatSlotTime(isoTime: string): string {
  const date = new Date(isoTime);

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: config.business.timezone,
  };

  return date.toLocaleString('en-US', options);
}

export function formatBookingTime(isoTime: string): string {
  const date = new Date(isoTime);

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: config.business.timezone,
  };

  return date.toLocaleString('en-US', options);
}
