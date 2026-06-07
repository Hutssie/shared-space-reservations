import { spaceAvailabilityInclude } from './spaceAvailabilityRules.js';

/**
 * Canonical amenity ids — one display label each, aligned with frontend AmenitiesList.
 * Do not add labels here that are not in FilterDropdowns.tsx.
 */
export const AMENITY_ID_TO_LABELS = {
  wifi: ['High-speed WiFi'],
  light: ['Natural Light'],
  coffee: ['Free Coffee'],
  parking: ['On-site Parking'],
  ac: ['Air Conditioning'],
  access: ['24/7 Access'],
  sound: ['Soundproofed'],
  cyc: ['Cyclorama Wall'],
  green: ['Green Screen'],
  audio: ['Pro Sound System'],
  mics: ['Recording Gear'],
  kitchen: ['Full Kitchen'],
  chef: ['Chef-grade Oven'],
  projector: ['Digital Projector'],
  conferencing: ['Video Conferencing'],
  monitors: ['Dual Monitors'],
  easels: ['Art Easels'],
  mirrors: ['Full-length Mirrors'],
  gym: ['Gym Equipment'],
  showers: ['Locker Rooms'],
  lab: ['Lab Equipment'],
};

/** Old label strings → id for resolveEntryToAmenityId only (not AI patterns). */
export const AMENITY_LEGACY_LABEL_ALIASES = {
  'ac & heating': 'ac',
  'sound isolation': 'sound',
  'professional sound system': 'audio',
  'pro tools hd': 'mics',
  'commercial range': 'chef',
  'double ovens': 'chef',
  'board table': 'monitors',
  'track lighting': 'easels',
  'white walls': 'easels',
  'full mirrors': 'mirrors',
};

/** Colloquial phrases for AI inference — must map to a host-selectable UI amenity id. */
export const AMENITY_EXTRA_PHRASES = {
  wifi: ['wifi', 'wireless', 'wi-fi', 'wireless internet'],
  light: ['lighting', 'daylight', 'well lit', 'well-lit', 'bright space'],
  coffee: ['espresso'],
  parking: [
    'parking',
    'on-site parking',
    'on site parking',
    'car park',
    'place to park',
    'somewhere to park',
    'park my car',
    'need parking',
    'somewhere to park my car',
  ],
  ac: ['a/c', 'heating and cooling'],
  access: ['24 hour access', 'round the clock access'],
  sound: ['soundproof', 'sound proof', 'sound isolation', 'soundproofing'],
  green: ['chroma key'],
  audio: ['sound system', 'speakers', 'good sound', 'pa system', 'pro audio'],
  mics: ['microphone', 'mic', 'recording equipment'],
  kitchen: ['cooking space'],
  chef: ['commercial oven'],
  projector: ['projector'],
  conferencing: ['zoom room', 'video calls'],
  monitors: ['dual monitor', 'boardroom table', 'board table'],
  easels: ['art easel', 'art easels'],
  mirrors: ['full mirror', 'dance mirror'],
  gym: ['fitness equipment', 'weights'],
  showers: ['locker room', 'changing room'],
  lab: ['laboratory equipment'],
};

/** Ids where bare \\bid\\b causes false positives — use label/extra patterns only. */
export const AMENITY_ID_TOKEN_BLOCKLIST = new Set(['light', 'sound']);

/** Label tokens too generic to auto-derive as standalone patterns. */
export const AMENITY_LABEL_STOPWORDS = new Set([
  'digital',
  'pro',
  'professional',
  'high',
  'speed',
  'on',
  'site',
  'full',
  'free',
  'grade',
  'dual',
  'board',
  'length',
  'commercial',
  'range',
  'double',
  'video',
  'art',
  'track',
  'white',
  'walls',
  'wall',
  'gear',
  'tools',
  'equipment',
  'system',
  'screen',
  'sound',
  'natural',
  'conditioning',
  'heating',
  'access',
  'locker',
  'rooms',
  'mirrors',
  'monitors',
  'table',
  'kitchen',
  'oven',
  'ovens',
  'conferencing',
  'easels',
  'lab',
  'recording',
]);

const LABEL_TO_ID = new Map();
for (const [id, labels] of Object.entries(AMENITY_ID_TO_LABELS)) {
  for (const label of labels) {
    LABEL_TO_ID.set(label.toLowerCase(), id);
  }
  LABEL_TO_ID.set(id.toLowerCase(), id);
}

const LEGACY_TO_ID = new Map(
  Object.entries(AMENITY_LEGACY_LABEL_ALIASES).map(([label, id]) => [label.toLowerCase(), id])
);

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function labelToRegexSource(label) {
  return escapeRegex(label).replace(/\s+/g, '\\s+').replace(/\\&/g, '\\s*&\\s*');
}

/** Generic "lighting" → light, but not in "track lighting". */
function phraseToPattern(phrase, id) {
  const escaped = escapeRegex(phrase).replace(/\s+/g, '\\s+');
  if (id === 'light' && phrase === 'lighting') {
    return new RegExp(`(?<!track\\s)\\blighting\\b`, 'i');
  }
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

function labelKeywords(label) {
  return String(label)
    .toLowerCase()
    .split(/[\s&/,-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 5 && !AMENITY_LABEL_STOPWORDS.has(t));
}

function patternKey(id, phrase) {
  return `${id}::${phrase.toLowerCase()}`;
}

export function buildAmenityUserPatterns() {
  const seen = new Set();
  const entries = [];

  function addEntry(id, phrase, pattern) {
    const key = patternKey(id, phrase);
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ id, phrase, pattern });
  }

  // Tier 1: catalog labels (UI only)
  for (const [id, labels] of Object.entries(AMENITY_ID_TO_LABELS)) {
    for (const label of labels) {
      addEntry(id, label, new RegExp(`\\b${labelToRegexSource(label)}\\b`, 'i'));
    }
  }

  // Tier 2: curated colloquial phrases
  for (const [id, phrases] of Object.entries(AMENITY_EXTRA_PHRASES)) {
    for (const phrase of phrases) {
      addEntry(id, phrase, phraseToPattern(phrase, id));
    }
  }

  // Tier 3a: safe canonical id tokens
  for (const id of Object.keys(AMENITY_ID_TO_LABELS)) {
    if (AMENITY_ID_TOKEN_BLOCKLIST.has(id)) continue;
    if (!/^[a-z]{2,}$/.test(id)) continue;
    addEntry(id, id, new RegExp(`\\b${escapeRegex(id)}\\b`, 'i'));
  }

  // Tier 3b: significant keywords from multi-word labels
  for (const [id, labels] of Object.entries(AMENITY_ID_TO_LABELS)) {
    for (const label of labels) {
      for (const keyword of labelKeywords(label)) {
        addEntry(id, keyword, new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i'));
      }
    }
  }

  entries.sort((a, b) => b.phrase.length - a.phrase.length);
  return entries.map(({ id, pattern }) => ({ id, pattern }));
}

export const AMENITY_USER_PATTERNS = buildAmenityUserPatterns();

export function inferAmenityIdsFromText(text) {
  const ids = new Set();
  const s = String(text || '');
  for (const { id, pattern } of AMENITY_USER_PATTERNS) {
    if (pattern.test(s)) ids.add(id);
  }
  return [...ids];
}

export function isKnownAmenityId(id) {
  return typeof id === 'string' && id in AMENITY_ID_TO_LABELS;
}

/** Resolve stored JSON entry (id or legacy label) to canonical amenity id. */
export function resolveEntryToAmenityId(entry) {
  if (entry == null) return null;
  const s = String(entry).trim();
  if (!s) return null;
  if (isKnownAmenityId(s)) return s;
  const lower = s.toLowerCase();
  return LABEL_TO_ID.get(lower) ?? LEGACY_TO_ID.get(lower) ?? null;
}

export function normalizeAmenityIds(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const ids = new Set();
  for (const entry of list) {
    const id = resolveEntryToAmenityId(entry);
    if (id) ids.add(id);
  }
  return [...ids];
}

export function amenitiesJsonFromIds(ids) {
  return JSON.stringify(normalizeAmenityIds(ids));
}

/** Prisma where: space must have every listed amenity (SQL via relation AND). */
export function amenityFilterClause(amenityIds) {
  const valid = normalizeAmenityIds(amenityIds);
  if (valid.length === 0) return {};
  return {
    AND: valid.map((amenityId) => ({
      amenities: { some: { amenityId } },
    })),
  };
}

export function amenitiesForResponse(space) {
  if (space.amenities?.length) {
    return space.amenities.map((a) => a.amenityId);
  }
  return [];
}

/** Amenity ids from a Prisma space row or a spaceToResponse card (string[] or relation). */
export function amenityIdsFromCardOrSpace(card) {
  const raw = card?.amenities;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'string') return normalizeAmenityIds(raw);
  return amenitiesForResponse(card);
}

export const spaceListInclude = {
  host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
  reviews: { select: { rating: true } },
  amenities: { select: { amenityId: true }, orderBy: { amenityId: 'asc' } },
  ...spaceAvailabilityInclude,
};

export async function seedAmenityCatalog(prisma) {
  for (const [id, labels] of Object.entries(AMENITY_ID_TO_LABELS)) {
    await prisma.amenity.upsert({
      where: { id },
      create: { id, label: labels[0] },
      update: { label: labels[0] },
    });
  }
}

export async function syncSpaceAmenities(prisma, spaceId, rawAmenities) {
  const amenityIds = normalizeAmenityIds(rawAmenities);
  await prisma.spaceAmenity.deleteMany({ where: { spaceId } });
  if (amenityIds.length === 0) return amenityIds;
  await prisma.spaceAmenity.createMany({
    data: amenityIds.map((amenityId) => ({ spaceId, amenityId })),
    skipDuplicates: true,
  });
  return amenityIds;
}
