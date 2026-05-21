import { config } from '../config/env.js';
import type { AvailabilitySlot, CalBookingResponse } from '../types/index.js';

const { calcom } = config;

interface CalV2SlotsResponse {
  status: string;
  data: Record<string, Array<{ start: string; end?: string }>>;
}

interface CalV2BookingResponse {
  status: string;
  data: {
    id: number;
    uid: string;
    title: string;
    status: string;
    start: string;
    end: string;
    duration?: number;
    location?: string;
    attendees?: Array<{ name: string; email: string }>;
  };
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

// Helper to get API headers for Cal.com v2
function getCalHeaders(includeContentType = false): Record<string, string> {
  const headers: Record<string, string> = {
    'cal-api-version': calcom.apiVersion,
    'Authorization': `Bearer ${calcom.apiKey}`,
  };
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
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

  // Format dates as YYYY-MM-DD
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  // Cal.com API v2 slots endpoint
  const url = new URL(`${calcom.baseUrl}/slots`);
  url.searchParams.set('eventTypeId', calcom.eventTypeId.toString());
  url.searchParams.set('start', startStr);
  url.searchParams.set('end', endStr);
  url.searchParams.set('timeZone', config.business.timezone);

  try {
    console.log('Fetching Cal.com availability:', url.toString().replace(calcom.apiKey, '***'));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getCalHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cal.com availability error:', errorText);
      throw new Error(`Cal.com API error: ${response.status}`);
    }

    const data = await response.json() as CalV2SlotsResponse;
    console.log('Cal.com response status:', data.status);

    const slots: AvailabilitySlot[] = [];

    if (data.data) {
      for (const [_date, daySlots] of Object.entries(data.data)) {
        for (const slot of daySlots) {
          slots.push({
            time: slot.start,
            displayTime: formatSlotTime(slot.start),
          });
        }
      }
    }

    slots.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    console.log(`Found ${slots.length} available slots`);
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
      title: '30 min Demo',
      startTime: startTime,
      endTime: new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString(),
      status: 'ACCEPTED',
    };
  }

  const url = `${calcom.baseUrl}/bookings`;

  // Cal.com API v2 booking format
  const body = {
    eventTypeId: calcom.eventTypeId,
    start: startTime,
    attendee: {
      name,
      email,
      timeZone: config.business.timezone,
    },
    metadata: {
      source: 'facebook-messenger-bot',
      notes: notes || '',
    },
  };

  try {
    console.log('Creating Cal.com booking for:', email);

    const response = await fetch(url, {
      method: 'POST',
      headers: getCalHeaders(true),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cal.com booking error:', errorText);
      throw new Error(`Cal.com booking failed: ${response.status}`);
    }

    const result = await response.json() as CalV2BookingResponse;
    console.log('Booking created successfully, uid:', result.data.uid);

    // Convert v2 response to our internal format
    return {
      id: result.data.id,
      uid: result.data.uid,
      title: result.data.title,
      startTime: result.data.start,
      endTime: result.data.end,
      status: result.data.status.toUpperCase(),
    };
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

  // Cal.com API v2 uses POST for cancellation
  const url = `${calcom.baseUrl}/bookings/${bookingUid}/cancel`;

  try {
    console.log('Cancelling Cal.com booking:', bookingUid);

    const response = await fetch(url, {
      method: 'POST',
      headers: getCalHeaders(true),
      body: JSON.stringify({
        cancellationReason: 'Cancelled via Facebook Messenger bot',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cal.com cancel error:', errorText);
      return false;
    }

    console.log('Booking cancelled successfully');
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

  const url = `${calcom.baseUrl}/bookings/${bookingUid}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getCalHeaders(),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as CalV2BookingResponse;
    return {
      id: result.data.id,
      uid: result.data.uid,
      title: result.data.title,
      startTime: result.data.start,
      endTime: result.data.end,
      status: result.data.status.toUpperCase(),
    };
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
