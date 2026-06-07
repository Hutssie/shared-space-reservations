import {
  AMENITY_USER_PATTERNS,
  amenityIdsFromCardOrSpace,
  amenitiesForResponse,
  inferAmenityIdsFromText,
  normalizeAmenityIds,
} from './amenities.js';
import { locationMentionMatches } from './textNormalize.js';
import {
  inferDateFromText,
  isDateOnlyLocationCandidate,
  LOCATION_CAPTURE_STOP_PATTERN,
  resolveDateFromMessages,
  resolvePriceFromMessages,
  resolveSizeFromMessages,
  stripFilterTokensFromLocation,
  userMentionedDateInMessages,
  userMentionedDate,
  userMentionedPrice,
  userMentionedSize,
} from './aiSearchFilterInference.js';

export { userMentionedDate, userMentionedPrice, userMentionedSize } from './aiSearchFilterInference.js';
export { AMENITY_USER_PATTERNS, inferAmenityIdsFromText } from './amenities.js';

export const AI_SPACE_CATEGORIES = [
  'Art Studio',
  'Photo Studio',
  'Recording Studio',
  'Kitchen Studio',
  'Dancing Studio',
  'Classroom',
  'Conference Room',
  'IT Classroom',
  'Laboratory',
  'Sports Space',
];

export const REFINEMENT_FILTER_KEYS = [
  'date',
  'startTime',
  'endTime',
  'minPrice',
  'maxPrice',
  'minCapacity',
  'minSquareMeters',
  'maxSquareMeters',
  'amenities',
];

/**
 * Countries, regions, counties, states — not a specific city.
 * Used for follow-up ("a specific city") and location scope.
 */
export const COUNTRY_REGION_ONLY = new Set([
  'romania',
  'united states',
  'usa',
  'us',
  'uk',
  'united kingdom',
  'ny',
  'new york',
  'california',
  'texas',
  'europe',
  'transylvania',
  'wallachia',
  'moldova',
  'dolj',
  'gorj',
  'mehedinti',
  'oltenia',
  'muntenia',
  'transilvania',
]);

export const VAGUE_LOCATION_PHRASES =
  /\b(anywhere|any\s+city|any\s+place|any\s+location|doesn't matter where|don't care where)\b/i;

const VAGUE_LOCATION_WORDS = new Set(['anywhere', 'everywhere', 'someplace']);

const CATEGORY_ALIASES = {
  photo: 'Photo Studio',
  recording: 'Recording Studio',
  kitchen: 'Kitchen Studio',
  dance: 'Dancing Studio',
  dancing: 'Dancing Studio',
  classroom: 'Classroom',
  conference: 'Conference Room',
  lab: 'Laboratory',
  art: 'Art Studio',
  sports: 'Sports Space',
  'photo studio': 'Photo Studio',
  'recording studio': 'Recording Studio',
  'kitchen studio': 'Kitchen Studio',
  'dancing studio': 'Dancing Studio',
  'conference room': 'Conference Room',
  'it classroom': 'IT Classroom',
  'art studio': 'Art Studio',
  'sports space': 'Sports Space',
  paint: 'Art Studio',
  painting: 'Art Studio',
  podcast: 'Recording Studio',
  cooking: 'Kitchen Studio',
  yoga: 'Sports Space',
  workshop: 'Classroom',
  meeting: 'Conference Room',
  coding: 'IT Classroom',
  laboratory: 'Laboratory',
};

/** Activity verbs / project intent — checked before venue phrases. Word-boundary regex only. */
export const CATEGORY_ACTIVITY_PATTERNS = [
  { pattern: /\bpaint(ing)?\b|\bdraw(ing)?\b|\bsketch(ing)?\b|\bsculpt(ing|ure)?\b/i, category: 'Art Studio' },
  {
    pattern:
      /\bshoot(ing)?\s+photos?\b|\btake\s+photos?\b|\btake\s+pictures?\b|\bmake\s+photos?\b|\bphotograph(y|ing)?\b|\bportraits?\b/i,
    category: 'Photo Studio',
  },
  {
    pattern:
      /\bmake\s+music\b|\bproduce\s+music\b|\bmusic\s+production\b|\blooking\s+to\s+record\b|\bwant\s+to\s+record\b|\brecord\s+something\b|\brecord(ing)?\s+(a\s+)?(podcast|song|audio|music)\b|\bsing(ing)?\b|\bvoice\s*over\b/i,
    category: 'Recording Studio',
  },
  {
    pattern:
      /\bcook(ing)?\b|\bbake(ing)?\b|\bfood\s+prep\b|\bcater(ing)?\b|\bmake\s+(pasta|food|meals?|bread|dinner|lunch)\b|\bprepare\s+(food|meals?)\b/i,
    category: 'Kitchen Studio',
  },
  {
    pattern:
      /\bdanc(e|ing)\b|\bballet\b|\bchoreograph(y|ing)?\b|\bdance\s+rehears(ing|al)\b|\brehears(e|ing)\s+(a\s+)?dance\b/i,
    category: 'Dancing Studio',
  },
  { pattern: /\btutor(ing)?\b|\blecture\b|\bteach(ing)?\s+(a\s+)?class\b|\btraining\s+session\b/i, category: 'Classroom' },
  { pattern: /\bteam\s+meeting\b|\bpresentation\b|\boffsite\b|\bboard\s+meeting\b/i, category: 'Conference Room' },
  {
    pattern:
      /\bprogrammer\b|\bdeveloper\b|\bsoftware\s+engineer\b|\bcode(ing)?\b|\bprogram(ming)?\b|\bhackathon\b|\bsoftware\s+dev\b/i,
    category: 'IT Classroom',
  },
  { pattern: /\bexperiments?\b|\bchemistry\b|\bresearch\b|\blab\s+work\b/i, category: 'Laboratory' },
  {
    pattern:
      /\bpilates\b|\bbarre\b|\byoga\b|\bwork\s*out\b|\bfitness\b|\bgym\s+session\b|\bgo\s+to\s+(a\s+)?gym\b|\bwork\s+out\s+at\s+(the\s+)?gym\b|\bgym\b(?!\s+equipment)\b|\bmartial\s+arts\b/i,
    category: 'Sports Space',
  },
];

/** Venue / compound intent phrases — avoid single-word aliases that false-positive in normal speech. */
export const CATEGORY_INTENT_PHRASES = [
  { pattern: /photo\s*shoot|product\s+shoot|portrait\s+session/i, category: 'Photo Studio' },
  { pattern: /photo\s+studio|photography/i, category: 'Photo Studio' },
  { pattern: /voice\s*over|audio\s+recording|music\s+session/i, category: 'Recording Studio' },
  { pattern: /recording\s+studio|podcast/i, category: 'Recording Studio' },
  { pattern: /recipe\s+video|food\s+shoot/i, category: 'Kitchen Studio' },
  { pattern: /kitchen\s+studio|cooking\s+class/i, category: 'Kitchen Studio' },
  { pattern: /dance\s+class|choreography|dance\s+rehearsal/i, category: 'Dancing Studio' },
  { pattern: /danc(e|ing)\s+studio/i, category: 'Dancing Studio' },
  { pattern: /hackathon|coding\s+class|programming\s+workshop/i, category: 'IT Classroom' },
  { pattern: /it\s+classroom|coding\s+bootcamp/i, category: 'IT Classroom' },
  { pattern: /science\s+experiment|chemistry|research\s+space/i, category: 'Laboratory' },
  { pattern: /laboratory|lab\s+space/i, category: 'Laboratory' },
  { pattern: /yoga\s+class|martial\s+arts|fitness\s+class/i, category: 'Sports Space' },
  { pattern: /sports\s+space|gym\s+space/i, category: 'Sports Space' },
  { pattern: /team\s+meeting|presentation|offsite/i, category: 'Conference Room' },
  { pattern: /conference\s+room/i, category: 'Conference Room' },
  { pattern: /seminar|tutoring|training\s+session/i, category: 'Classroom' },
  { pattern: /classroom|workshop\s+venue/i, category: 'Classroom' },
  { pattern: /sculpting|fine\s+art|canvas/i, category: 'Art Studio' },
  { pattern: /art\s+studio/i, category: 'Art Studio' },
];

const CATEGORY_PHRASES = [...CATEGORY_ACTIVITY_PATTERNS, ...CATEGORY_INTENT_PHRASES];

const LOCATION_IN_TEXT =
  /\b(?:in|near|around|at)\s+([A-Za-z][A-Za-z\s,.'-]{1,60})/gi;

/** "anywhere in Dolj" / "anywhere in Romania" — location is the place after "in". */
const ANYWHERE_IN_RE = new RegExp(
  `\\banywhere\\s+in\\s+([A-Za-z][A-Za-z\\s,.'-]{1,60}?)(?=\\s+(?:${LOCATION_CAPTURE_STOP_PATTERN})\\b|[?.!,]|$)`,
  'i'
);

function normalizeCategory(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (AI_SPACE_CATEGORIES.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  return CATEGORY_ALIASES[lower] ?? CATEGORY_ALIASES[trimmed] ?? null;
}

export function inferCategoryFromText(text) {
  const s = String(text || '');
  if (!s.trim()) return null;

  for (const { pattern, category } of CATEGORY_PHRASES) {
    if (pattern.test(s)) return category;
  }

  for (const cat of AI_SPACE_CATEGORIES) {
    if (s.toLowerCase().includes(cat.toLowerCase())) return cat;
  }

  const words = s.toLowerCase().split(/\s+/);
  for (const word of words) {
    const mapped = CATEGORY_ALIASES[word];
    if (mapped) return mapped;
  }

  return null;
}

export function parseAnywhereInLocation(text) {
  const match = String(text || '').match(ANYWHERE_IN_RE);
  if (!match) return null;
  const candidate = stripFilterTokensFromLocation(match[1].trim().replace(/[?.!]+$/, ''));
  return isRealLocationCandidate(candidate) ? candidate : null;
}

export function userHasVagueLocationIntent(userText) {
  const s = String(userText || '');
  if (parseAnywhereInLocation(s)) return false;
  return VAGUE_LOCATION_PHRASES.test(s);
}

export function isRealLocationCandidate(candidate) {
  if (!candidate || typeof candidate !== 'string') return false;
  const trimmed = candidate.trim().replace(/[?.!]+$/, '');
  if (trimmed.length < 2) return false;

  const lower = trimmed.toLowerCase();
  if (VAGUE_LOCATION_WORDS.has(lower)) return false;
  if (VAGUE_LOCATION_PHRASES.test(lower)) return false;
  if (isDateOnlyLocationCandidate(trimmed)) return false;

  return true;
}

export function userMentionedCapacity(userText) {
  return /\b(\d+\s*(people|persons|guests|attendees)|capacity|fit\s+\d+)\b/i.test(String(userText || ''));
}

export function inferLocationFromText(text) {
  const s = String(text || '');
  if (!s.trim()) return null;

  const anywhereIn = parseAnywhereInLocation(s);
  if (anywhereIn) return anywhereIn;

  if (userHasVagueLocationIntent(s)) return null;

  const matches = [...s.matchAll(LOCATION_IN_TEXT)];
  if (matches.length > 0) {
    const candidate = stripFilterTokensFromLocation(
      matches[matches.length - 1][1].trim().replace(/[?.!]+$/, '')
    );
    if (isRealLocationCandidate(candidate)) return candidate;
  }

  return null;
}

function pickSearchField(searchParams, key) {
  if (!searchParams || searchParams[key] == null) return null;
  const val = searchParams[key];
  if (key === 'amenities') {
    return Array.isArray(val) && val.length > 0 ? val : null;
  }
  if (typeof val === 'string') {
    const t = val.trim();
    return t.length > 0 ? t : null;
  }
  return val;
}

/** True when the location string appears in user text (Gemini did not invent it). */
export function userMentionedLocation(userText, location) {
  return locationMentionMatches(userText, location);
}

function resolveLocation(userText, searchParams) {
  const anywhereIn = parseAnywhereInLocation(userText);
  if (anywhereIn) return anywhereIn;

  if (userHasVagueLocationIntent(userText)) return null;

  const inferred = inferLocationFromText(userText);
  const fromSearch = pickSearchField(searchParams, 'location');

  if (fromSearch && userMentionedLocation(userText, fromSearch)) {
    return fromSearch;
  }

  if (inferred) return inferred;

  return null;
}

function getUserMessageTexts(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m.role === 'user')
    .map((m) => String(m.content || ''));
}

/** Prefer the most recent user turn so earlier "anywhere in dolj" does not override "in craiova". */
function resolveLocationFromMessages(userMessages, searchParams) {
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const loc = resolveLocation(userMessages[i], searchParams);
    if (loc) return loc;
  }
  return null;
}

function resolveCategoryFromMessages(userMessages, searchParams) {
  const fromSearch = normalizeCategory(pickSearchField(searchParams, 'category'));
  if (fromSearch) {
    for (let i = userMessages.length - 1; i >= 0; i--) {
      const inferred = inferCategoryFromText(userMessages[i]);
      if (inferred) return inferred;
      if (userMessages[i].toLowerCase().includes(fromSearch.toLowerCase())) return fromSearch;
    }
    return fromSearch;
  }
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const cat = inferCategoryFromText(userMessages[i]);
    if (cat) return cat;
  }
  return null;
}

function amenityMentionedInText(userText, amenityId) {
  return inferAmenityIdsFromText(userText).includes(amenityId);
}

function resolveAmenitiesFromMessages(userMessages, searchParams) {
  const ids = new Set();
  for (const text of userMessages) {
    for (const id of inferAmenityIdsFromText(text)) ids.add(id);
  }
  if (ids.size > 0) return [...ids];

  const fromSearch = normalizeAmenityIds(searchParams?.amenities ?? []);
  const trusted = fromSearch.filter((id) =>
    userMessages.some((text) => amenityMentionedInText(text, id))
  );
  return trusted.length > 0 ? trusted : null;
}

function turnHasCategory(text) {
  return Boolean(inferCategoryFromText(text));
}

function turnHasLocation(text) {
  return Boolean(inferLocationFromText(text) || parseAnywhereInLocation(text));
}

function turnMentionedDate(text, referenceDate) {
  return userMentionedDate(text) || Boolean(inferDateFromText(text, referenceDate));
}

/**
 * Clear date on full restatement (category + location, no date) but keep it when
 * completing a clarify turn that only adds category or location to an earlier date.
 */
function shouldClearStaleDateOnRestatement(userMessages, latestText, referenceDate) {
  if (!turnHasCategory(latestText) || userMentionedDate(latestText)) {
    return false;
  }
  if (!turnHasLocation(latestText)) {
    return false;
  }

  for (let i = 0; i < userMessages.length - 1; i++) {
    const text = userMessages[i];
    if (!turnMentionedDate(text, referenceDate)) continue;
    const hadCategory = turnHasCategory(text);
    const hadLocation = turnHasLocation(text);
    if (!hadCategory || !hadLocation) {
      return false;
    }
  }

  return true;
}

export function extractKnownFilters(messages, searchParams = null, { referenceDate = new Date() } = {}) {
  const userMessages = getUserMessageTexts(messages);
  const userText = userMessages.join(' ');

  const category = resolveCategoryFromMessages(userMessages, searchParams);
  const location = resolveLocationFromMessages(userMessages, searchParams);
  const amenities = resolveAmenitiesFromMessages(userMessages, searchParams);
  const regionalLocationScope = isBroadLocation(location);
  let { minPrice, maxPrice } = resolvePriceFromMessages(userMessages, searchParams);
  let { minSquareMeters, maxSquareMeters } = resolveSizeFromMessages(userMessages, searchParams);
  const latestText = userMessages[userMessages.length - 1] || '';
  if (inferCategoryFromText(latestText) && !userMentionedPrice(latestText)) {
    minPrice = null;
    maxPrice = null;
  }
  if (inferCategoryFromText(latestText) && !userMentionedSize(latestText)) {
    minSquareMeters = null;
    maxSquareMeters = null;
  }
  let date = resolveDateFromMessages(userMessages, searchParams, referenceDate);
  const dateMentioned = userMentionedDateInMessages(userMessages);
  let startTime = dateMentioned || date ? pickSearchField(searchParams, 'startTime') : null;
  let endTime = dateMentioned || date ? pickSearchField(searchParams, 'endTime') : null;
  if (inferCategoryFromText(latestText) && !userMentionedDate(latestText)) {
    if (shouldClearStaleDateOnRestatement(userMessages, latestText, referenceDate)) {
      date = null;
      startTime = null;
      endTime = null;
    }
  }

  return {
    location: location || null,
    category: category || null,
    regionalLocationScope,
    q: pickSearchField(searchParams, 'q'),
    date: dateMentioned || date ? date : null,
    startTime,
    endTime,
    minPrice,
    maxPrice,
    minCapacity: userMentionedCapacity(userText) ? (searchParams?.minCapacity ?? null) : null,
    minSquareMeters,
    maxSquareMeters,
    amenities,
  };
}

/** Merge trusted policy filters into Gemini SEARCH params for the search ladder. */
export function buildSearchParamsForLadder(knownFilters, searchParams = null) {
  const merged = {
    ...(searchParams && typeof searchParams === 'object' ? searchParams : {}),
    location: knownFilters.location,
    category: knownFilters.category,
    q: knownFilters.q,
    date: knownFilters.date,
    startTime: knownFilters.startTime,
    endTime: knownFilters.endTime,
    minPrice: knownFilters.minPrice,
    maxPrice: knownFilters.maxPrice,
    minCapacity: knownFilters.minCapacity,
    minSquareMeters: knownFilters.minSquareMeters,
    maxSquareMeters: knownFilters.maxSquareMeters,
    amenities: knownFilters.amenities ?? [],
  };

  if (merged.location && merged.category) {
    merged.q = null;
  }

  return merged;
}

export function hasEnoughForCards(filters) {
  return Boolean(filters?.location && filters?.category);
}

export function missingForCards(filters) {
  const missing = [];
  if (!filters?.location) missing.push('location');
  if (!filters?.category) missing.push('category');
  return missing;
}

export function isBroadLocation(location) {
  if (!location || typeof location !== 'string') return false;
  const lower = location.trim().toLowerCase();
  if (!lower) return false;
  if (COUNTRY_REGION_ONLY.has(lower)) return true;
  const tokens = lower.split(/\s+/).filter(Boolean);
  return tokens.length === 1 && COUNTRY_REGION_ONLY.has(tokens[0]);
}

/**
 * True when the user named a specific city (not country/region/county).
 */
export function isSpecificCity(location, filters = null) {
  if (!location || typeof location !== 'string') return false;
  if (filters?.regionalLocationScope) return false;
  if (isBroadLocation(location)) return false;

  const trimmed = location.trim();
  if (!trimmed) return false;

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const cityPart = parts[0].toLowerCase();
      if (!COUNTRY_REGION_ONLY.has(cityPart)) return true;
    }
  }

  const lower = trimmed.toLowerCase();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && !COUNTRY_REGION_ONLY.has(lower)) {
    return true;
  }

  if (tokens.length >= 2 && !COUNTRY_REGION_ONLY.has(lower)) {
    return true;
  }

  return false;
}

export function countRefinementFilters(filters) {
  if (!filters) return 0;
  let count = 0;
  if (filters.date) count += 1;
  if (filters.minPrice != null || filters.maxPrice != null) count += 1;
  if (filters.minCapacity != null) count += 1;
  if (filters.minSquareMeters != null || filters.maxSquareMeters != null) count += 1;
  if (Array.isArray(filters.amenities) && filters.amenities.length > 0) count += 1;
  return count;
}

export function computeMissingRefinements(filters) {
  const missing = [];
  if (!isSpecificCity(filters?.location, filters)) missing.push('specificCity');
  if (!filters?.date) missing.push('date');
  if (filters?.minPrice == null && filters?.maxPrice == null) missing.push('budget');
  if (filters?.minCapacity == null) missing.push('capacity');
  if (filters?.minSquareMeters == null && filters?.maxSquareMeters == null) missing.push('size');
  if (!Array.isArray(filters?.amenities) || filters.amenities.length === 0) missing.push('amenities');
  return missing;
}

export function shouldSuggestFollowUp(filters) {
  if (!hasEnoughForCards(filters)) return false;
  return !(isSpecificCity(filters.location, filters) && countRefinementFilters(filters) >= 2);
}

const FOLLOW_UP_LABELS = {
  specificCity: 'a specific city',
  date: 'the date you wish to book a space',
  budget: 'your budget',
  capacity: 'how many people will join',
  size: 'how much space you need',
  amenities: 'any amenities you need',
};

export function buildClarifyMessage(missing) {
  if (!missing?.length) {
    return "Could you tell me what kind of space you're looking for and where you'd like it to be?";
  }
  if (missing.length === 2) {
    return "To find the right spaces for you, could you tell me **what type of space** you need and **where** you'd like it (city, region, or country)?";
  }
  if (missing.includes('location')) {
    return "I'd love to help! **Where** are you looking for a space — a city, region, or country?";
  }
  return "I'd love to help! **What type of space** are you looking for — for example, an **Art Studio**, **Photo Studio**, or **Recording Studio**?";
}

export function buildResultMessage(resultType, cardCount = 0) {
  switch (resultType) {
    case 'exact':
      return 'Here is what I think you would like:';
    case 'close':
      if (cardCount === 1) {
        return 'Unfortunately, there are no spaces that fit your criteria exactly, but this was the closest match:';
      }
      return 'Unfortunately, there are no spaces that fit your criteria exactly, but here are the closest matches:';
    case 'none':
      return 'Unfortunately, there are currently no spaces that match your criteria. Would you like to search for something else?';
    default:
      return '';
  }
}

export function buildFollowUpHint(missingRefinements) {
  if (!missingRefinements?.length) return '';

  const labels = missingRefinements
    .map((key) => FOLLOW_UP_LABELS[key])
    .filter(Boolean);

  if (labels.length === 0) return '';

  const listText = labels.join(', ');
  return `If you would like to narrow the search down even more, provide me with more information like ${listText}, or anything else on your mind and I will be happy to help!`;
}

/**
 * Ordered search param steps: strict first, then relax optional filters only.
 * Category, location, and date/time always preserved when originally set.
 */
export function buildCloseMatchSteps(searchParams) {
  if (!searchParams || typeof searchParams !== 'object') return [];

  const core = {
    location: searchParams.location ?? null,
    category: searchParams.category ?? null,
    q: searchParams.location && searchParams.category ? null : (searchParams.q ?? null),
    date: searchParams.date ?? null,
    startTime: searchParams.startTime ?? null,
    endTime: searchParams.endTime ?? null,
    minPrice: searchParams.minPrice ?? null,
    maxPrice: searchParams.maxPrice ?? null,
    minCapacity: searchParams.minCapacity ?? null,
    minSquareMeters: searchParams.minSquareMeters ?? null,
    maxSquareMeters: searchParams.maxSquareMeters ?? null,
    amenities: Array.isArray(searchParams.amenities) ? [...searchParams.amenities] : [],
  };

  return [
    { ...core },
    { ...core, amenities: [] },
    { ...core, amenities: [], minPrice: null, maxPrice: null },
    { ...core, amenities: [], minPrice: null, maxPrice: null, minCapacity: null },
    {
      ...core,
      amenities: [],
      minPrice: null,
      maxPrice: null,
      minCapacity: null,
      minSquareMeters: null,
      maxSquareMeters: null,
    },
  ];
}

/**
 * Classify how search results were found.
 * @param {'relaxed'|null} fallbackSource
 */
export function classifySearchResult(strictCount, fallbackSource) {
  if (strictCount > 0) return 'exact';
  if (fallbackSource === 'relaxed') return 'close';
  return 'none';
}

/**
 * Defense-in-depth: strict cards must respect inferred optional filters.
 */
export function cardsSatisfyKnownFilters(cards, knownFilters) {
  if (!cards?.length || !knownFilters) return true;

  for (const card of cards) {
    const price = card.price ?? card.pricePerHour;
    const sqm = card.squareMeters;
    const sizeFilterActive =
      knownFilters.minSquareMeters != null || knownFilters.maxSquareMeters != null;

    if (knownFilters.maxPrice != null && price != null && Number(price) > Number(knownFilters.maxPrice)) {
      return false;
    }
    if (knownFilters.minPrice != null && price != null && Number(price) < Number(knownFilters.minPrice)) {
      return false;
    }
    if (sizeFilterActive && sqm == null) {
      return false;
    }
    if (
      knownFilters.minSquareMeters != null &&
      sqm != null &&
      Number(sqm) < Number(knownFilters.minSquareMeters)
    ) {
      return false;
    }
    if (
      knownFilters.maxSquareMeters != null &&
      sqm != null &&
      Number(sqm) > Number(knownFilters.maxSquareMeters)
    ) {
      return false;
    }

    const requestedAmenities = normalizeAmenityIds(knownFilters.amenities ?? []);
    if (requestedAmenities.length > 0) {
      const cardAmenities = amenityIdsFromCardOrSpace(card);
      if (!requestedAmenities.every((id) => cardAmenities.includes(id))) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Rank spaces by how many requested amenities they share (for partial close-match).
 * Tie-breaks with RAG retrieval order, then stable id.
 */
export function rankSpacesByAmenityOverlap(spaces, requestedAmenityIds, retrieved = []) {
  const requested = normalizeAmenityIds(requestedAmenityIds);
  if (!requested.length || !spaces?.length) return [];

  const retrievalRank = new Map((retrieved ?? []).map((s, i) => [s.id, i]));

  return [...spaces]
    .map((space) => {
      const spaceIds = amenitiesForResponse(space);
      const overlap = requested.filter((id) => spaceIds.includes(id)).length;
      return { space, overlap };
    })
    .filter((x) => x.overlap > 0)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      const ra = retrievalRank.has(a.space.id)
        ? retrievalRank.get(a.space.id)
        : Number.MAX_SAFE_INTEGER;
      const rb = retrievalRank.has(b.space.id)
        ? retrievalRank.get(b.space.id)
        : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(a.space.id).localeCompare(String(b.space.id));
    })
    .map((x) => x.space);
}

/** Build minimal SEARCH params when Gemini omits the block but policy has enough info. */
export function buildFallbackSearchParams(filters) {
  if (!hasEnoughForCards(filters)) return null;
  return {
    location: filters.location,
    category: filters.category,
  };
}
