/** Romanian and Latin diacritic folding for accent-insensitive search. */
const ROMANIAN_FOLDS = [
  [/ă/g, 'a'],
  [/â/g, 'a'],
  [/î/g, 'i'],
  [/ș/g, 's'],
  [/ş/g, 's'],
  [/ț/g, 't'],
  [/ţ/g, 't'],
  [/Ă/g, 'A'],
  [/Â/g, 'A'],
  [/Î/g, 'I'],
  [/Ș/g, 'S'],
  [/Ş/g, 'S'],
  [/Ț/g, 'T'],
  [/Ţ/g, 'T'],
];

export function foldDiacritics(text) {
  let s = String(text ?? '');
  if (!s) return s;
  s = s.normalize('NFKD').replace(/\p{M}+/gu, '');
  for (const [from, to] of ROMANIAN_FOLDS) {
    s = s.replace(from, to);
  }
  return s;
}

export function normalizeForSearch(text) {
  return foldDiacritics(String(text ?? ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function locationNormFromDisplay(location) {
  return normalizeForSearch(location);
}

/** Comma-separated place parts from a normalized location string. */
export function locationSegments(norm) {
  return String(norm ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * True when query matches a whole segment of locationNorm (structured filter semantics).
 * Avoids substring false positives (e.g. roma/rome vs romania).
 */
export function locationNormExactMatch(locationNorm, queryNorm) {
  const q = normalizeForSearch(queryNorm);
  const loc = normalizeForSearch(locationNorm);
  if (!q || !loc) return false;
  if (loc === q) return true;
  if (loc.startsWith(`${q}, `)) return true;
  if (loc.endsWith(`, ${q}`)) return true;
  if (loc.includes(`, ${q}, `)) return true;
  return false;
}

/** Prisma where: segment-exact match on location_norm (AI search, browse ?location=). */
export function buildLocationNormExactFilter(queryNorm) {
  const q = normalizeForSearch(queryNorm);
  if (!q) return {};
  return {
    OR: [
      { locationNorm: q },
      { locationNorm: { startsWith: `${q}, ` } },
      { locationNorm: { endsWith: `, ${q}` } },
      { locationNorm: { contains: `, ${q}, ` } },
    ],
  };
}

/**
 * Prisma where: autocomplete prefix on location_norm.
 * Exact segments plus primary-string prefix for partial typing (e.g. bail -> bailesti).
 */
export function buildLocationNormPrefixFilter(queryNorm) {
  const q = normalizeForSearch(queryNorm);
  if (!q) return {};
  const exact = buildLocationNormExactFilter(q);
  return {
    OR: [...exact.OR, { locationNorm: { startsWith: q } }],
  };
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary mention of a normalized place segment in user text. */
export function userTextMentionsSegment(textNorm, segmentNorm) {
  const seg = normalizeForSearch(segmentNorm);
  if (!seg || !textNorm) return false;
  const re = new RegExp(`\\b${escapeRegex(seg).replace(/\s+/g, '\\s+')}\\b`, 'i');
  return re.test(textNorm);
}

/**
 * True when user text mentions the location phrase (policy trust checks).
 * Uses segment/word-boundary logic aligned with buildLocationNormExactFilter.
 */
export function locationMentionMatches(userText, locationPhrase) {
  if (!locationPhrase || !userText) return false;
  const textNorm = normalizeForSearch(userText);
  const locNorm = normalizeForSearch(locationPhrase);
  if (!textNorm || !locNorm) return false;

  if (locationNormExactMatch(textNorm, locNorm)) return true;
  if (userTextMentionsSegment(textNorm, locNorm)) return true;

  for (const seg of locationSegments(locNorm)) {
    if (seg.length >= 2 && userTextMentionsSegment(textNorm, seg)) return true;
  }

  return false;
}
