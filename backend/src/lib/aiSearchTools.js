import { SchemaType } from '@google/generative-ai';
import { AI_SPACE_CATEGORIES } from './aiSearchPolicy.js';
import { AMENITY_ID_TO_LABELS, normalizeAmenityIds } from './amenities.js';

export const SEARCH_SPACES_TOOL_NAME = 'search_spaces';

const AMENITY_IDS = Object.keys(AMENITY_ID_TO_LABELS);

export const SEARCH_SPACES_DECLARATION = {
  name: SEARCH_SPACES_TOOL_NAME,
  description:
    'Search SpaceBook listings when the user provided both a location (city, region, or country) and a space category (explicit or inferred from project intent). Include optional filters only when confidently inferred from the conversation.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      location: {
        type: SchemaType.STRING,
        description:
          'Geographic scope the user provided: city, neighborhood, region/county/state, or country. Never invent a location the user did not mention.',
      },
      category: {
        type: SchemaType.STRING,
        description: 'Space category — must be one of the exact SpaceBook category names.',
        enum: AI_SPACE_CATEGORIES,
      },
      q: {
        type: SchemaType.STRING,
        description: 'Freeform keyword search across titles and descriptions.',
      },
      minPrice: { type: SchemaType.NUMBER, description: 'Minimum price per hour.' },
      maxPrice: { type: SchemaType.NUMBER, description: 'Maximum price per hour.' },
      minCapacity: { type: SchemaType.NUMBER, description: 'Minimum guest capacity.' },
      minSquareMeters: { type: SchemaType.NUMBER, description: 'Minimum space size in square meters.' },
      maxSquareMeters: { type: SchemaType.NUMBER, description: 'Maximum space size in square meters.' },
      amenities: {
        type: SchemaType.ARRAY,
        description: 'Required amenity IDs.',
        items: { type: SchemaType.STRING, enum: AMENITY_IDS },
      },
      date: {
        type: SchemaType.STRING,
        description: 'Booking date in YYYY-MM-DD format.',
      },
      startTime: {
        type: SchemaType.STRING,
        description: 'Start time slot in HH:MM AM/PM format. Requires date.',
      },
      endTime: {
        type: SchemaType.STRING,
        description: 'End time slot in HH:MM AM/PM format. Requires date.',
      },
    },
  },
};

export const SEARCH_SPACES_TOOLS = [{ functionDeclarations: [SEARCH_SPACES_DECLARATION] }];

function coerceNumber(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function coerceString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

/**
 * Normalize raw Gemini tool args into search ladder params.
 * Invalid categories become null so policy/user inference can fill them.
 */
export function normalizeToolArgs(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const category = coerceString(raw.category);
  const validCategory = category && AI_SPACE_CATEGORIES.includes(category) ? category : null;

  const amenities = normalizeAmenityIds(
    Array.isArray(raw.amenities) ? raw.amenities : []
  );

  return {
    location: coerceString(raw.location),
    category: validCategory,
    q: coerceString(raw.q),
    minPrice: coerceNumber(raw.minPrice),
    maxPrice: coerceNumber(raw.maxPrice),
    minCapacity: coerceNumber(raw.minCapacity),
    minSquareMeters: coerceNumber(raw.minSquareMeters),
    maxSquareMeters: coerceNumber(raw.maxSquareMeters),
    amenities,
    date: coerceString(raw.date),
    startTime: coerceString(raw.startTime),
    endTime: coerceString(raw.endTime),
  };
}

/**
 * Extract search_spaces params from a Gemini EnhancedGenerateContentResponse.
 * @returns {{ searchParams: object|null, toolUsed: boolean }}
 */
export function parseSearchToolCall(response) {
  if (!response || typeof response.functionCalls !== 'function') {
    return { searchParams: null, toolUsed: false };
  }

  let calls;
  try {
    calls = response.functionCalls();
  } catch {
    return { searchParams: null, toolUsed: false };
  }

  if (!Array.isArray(calls) || calls.length === 0) {
    return { searchParams: null, toolUsed: false };
  }

  const searchCall = calls.find((c) => c?.name === SEARCH_SPACES_TOOL_NAME) ?? calls[0];
  if (!searchCall || searchCall.name !== SEARCH_SPACES_TOOL_NAME) {
    return { searchParams: null, toolUsed: false };
  }

  if (calls.length > 1 && calls[0] !== searchCall) {
    console.warn('[AI Search] Multiple function calls; using first search_spaces call.');
  }

  const args = searchCall.args ?? searchCall.arguments ?? {};
  return {
    searchParams: normalizeToolArgs(args),
    toolUsed: true,
  };
}
