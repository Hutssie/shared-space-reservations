const PRICE_INTENT_RE =
  /\b(max(?:imum)?|up\s+to|under|below|less\s+than|at\s+most|min(?:imum)?|at\s+least|budget|between|per\s+hour|an\s+hour|\/hour|\/hr|\/h|hourly|bucks|dollars|\$|€)\b|\d+(?:\.\d+)?\s*(?:per\s+hour|an\s+hour|\/hour|\/hr|\/h)\b|\d+(?:\.\d+)?\/(?:hour|hr|h)\b|€\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*€/i;

const SIZE_UNIT = '(?:sqm|m²|square\\s+meters?|meters?\\s+square)';
const HOURLY_RATE_RE =
  /\$?\d+(?:\.\d+)?(?:\s*(?:per\s+hour|an\s+hour)|\/(?:hour|hr|h))\b|\$?\d+(?:\.\d+)?\s*(?:bucks|dollars)\b/gi;
const SIZE_INTENT_RE = new RegExp(
  `\\b(max(?:imum)?|min(?:imum)?|at\\s+least|at\\s+most|under|below|between|should\\s+have|\\d+\\s*${SIZE_UNIT})\\b`,
  'i'
);

const MONTH_NAMES = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const WEEKDAY_NAMES = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const WEEKDAY_PATTERN = Object.keys(WEEKDAY_NAMES).join('|');
const MONTH_PATTERN = Object.keys(MONTH_NAMES).join('|');

/** Stop words for anywhere-in location capture (also used when stripping date tails). */
export const LOCATION_CAPTURE_STOP_PATTERN =
  `that|with|who|and|or|for|on|today|tomorrow|tonight|next\\s+week|this\\s+weekend|next\\s+(?:${WEEKDAY_PATTERN})|this\\s+(?:${WEEKDAY_PATTERN})|(?:${WEEKDAY_PATTERN})`;

function parseAmount(raw) {
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeOrderedBounds(first, second) {
  const a = parseAmount(first);
  const b = parseAmount(second);
  if (a == null || b == null) return { low: a, high: b };
  return a <= b ? { low: a, high: b } : { low: b, high: a };
}

function parseSizeAmount(raw) {
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function normalizeReferenceDate(referenceDate) {
  const d = referenceDate instanceof Date ? new Date(referenceDate) : new Date(referenceDate);
  if (Number.isNaN(d.getTime())) return startOfLocalDay(new Date());
  return startOfLocalDay(d);
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function formatDateIso(date) {
  const d = startOfLocalDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, days) {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

function buildDate(year, monthIndex, day) {
  const d = new Date(year, monthIndex, day, 12, 0, 0, 0);
  if (d.getMonth() !== monthIndex || d.getDate() !== day) return null;
  return d;
}

function nextNamedMonthDay(reference, monthIndex, day, yearExplicit) {
  const ref = normalizeReferenceDate(reference);
  let year = yearExplicit ?? ref.getFullYear();
  let candidate = buildDate(year, monthIndex, day);
  if (!candidate) return null;
  if (!yearExplicit && candidate < ref) {
    candidate = buildDate(year + 1, monthIndex, day);
  }
  return candidate ? formatDateIso(candidate) : null;
}

function parseIsoDate(text) {
  const match = String(text).match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) return null;
  const d = buildDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return d ? formatDateIso(d) : null;
}

function parseNumericDateParts(day, month, year, referenceDate) {
  let y = year;
  if (y < 100) {
    const refYear = normalizeReferenceDate(referenceDate).getFullYear();
    y = Math.floor(refYear / 100) * 100 + y;
    if (y < refYear - 50) y += 100;
  }
  const d = buildDate(y, month - 1, day);
  return d ? formatDateIso(d) : null;
}

/** Prefer DD/MM (EU) for numeric slash, dash, and dot dates. */
function parseNumericDate(text, referenceDate = new Date()) {
  const s = String(text);
  let match = s.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (match) {
    return parseNumericDateParts(Number(match[1]), Number(match[2]), Number(match[3]), referenceDate);
  }
  match = s.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (match) {
    return parseNumericDateParts(Number(match[1]), Number(match[2]), Number(match[3]), referenceDate);
  }
  return null;
}

function parseNamedDate(text, referenceDate) {
  const s = String(text);
  const monthPattern = Object.keys(MONTH_NAMES).join('|');

  const mdy = new RegExp(
    `\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?(?:\\s+(\\d{4}))?\\b`,
    'i'
  );
  let match = s.match(mdy);
  if (match) {
    const monthIndex = MONTH_NAMES[match[1].toLowerCase()];
    return nextNamedMonthDay(referenceDate, monthIndex, Number(match[2]), match[3] ? Number(match[3]) : null);
  }

  const dmy = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthPattern})(?:\\s+(\\d{4}))?\\b`,
    'i'
  );
  match = s.match(dmy);
  if (match) {
    const monthIndex = MONTH_NAMES[match[2].toLowerCase()];
    return nextNamedMonthDay(referenceDate, monthIndex, Number(match[1]), match[3] ? Number(match[3]) : null);
  }

  return null;
}

function nextOrdinalInReferenceMonth(referenceDate, day) {
  const ref = normalizeReferenceDate(referenceDate);
  let year = ref.getFullYear();
  let monthIndex = ref.getMonth();
  let candidate = buildDate(year, monthIndex, day);
  if (!candidate) return null;
  if (candidate < ref) {
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
    candidate = buildDate(year, monthIndex, day);
  }
  return candidate ? formatDateIso(candidate) : null;
}

function parseOrdinalDate(text, referenceDate) {
  const s = String(text);
  const match = s.match(/\b(?:on\s+|the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?!\s+of\b)/i);
  if (!match) return null;
  return nextOrdinalInReferenceMonth(referenceDate, Number(match[1]));
}

function daysUntilWeekday(reference, targetDay, { forceNextWeek = false } = {}) {
  const ref = normalizeReferenceDate(reference);
  const current = ref.getDay();
  let delta = (targetDay - current + 7) % 7;
  if (delta === 0 && forceNextWeek) delta = 7;
  return delta;
}

function parseRelativeAndWeekday(text, referenceDate) {
  const s = String(text).toLowerCase();
  const ref = normalizeReferenceDate(referenceDate);

  if (/\btonight\b|\btoday\b/.test(s)) return formatDateIso(ref);
  if (/\btomorrow\b/.test(s)) return formatDateIso(addDays(ref, 1));
  if (/\bnext\s+week\b/.test(s)) return formatDateIso(addDays(ref, 7));

  if (/\bthis\s+weekend\b/.test(s)) {
    if (ref.getDay() === 6 || ref.getDay() === 0) return formatDateIso(ref);
    const delta = daysUntilWeekday(ref, 6, { forceNextWeek: false });
    return formatDateIso(addDays(ref, delta));
  }

  const weekdayPattern = Object.keys(WEEKDAY_NAMES).join('|');
  const nextDay = new RegExp(`\\bnext\\s+(${weekdayPattern})\\b`, 'i');
  let match = s.match(nextDay);
  if (match) {
    const target = WEEKDAY_NAMES[match[1]];
    return formatDateIso(addDays(ref, daysUntilWeekday(ref, target, { forceNextWeek: true })));
  }

  const thisDay = new RegExp(`\\bthis\\s+(${weekdayPattern})\\b`, 'i');
  match = s.match(thisDay);
  if (match) {
    const target = WEEKDAY_NAMES[match[1]];
    let delta = daysUntilWeekday(ref, target, { forceNextWeek: false });
    if (delta === 0 && ref.getDay() !== target) delta = 7;
    return formatDateIso(addDays(ref, delta));
  }

  const bareDay = new RegExp(`\\b(${weekdayPattern})\\b`, 'i');
  match = s.match(bareDay);
  if (match) {
    const target = WEEKDAY_NAMES[match[1]];
    let delta = daysUntilWeekday(ref, target, { forceNextWeek: false });
    if (delta === 0) return formatDateIso(ref);
    return formatDateIso(addDays(ref, delta));
  }

  return null;
}

export function inferDateFromText(text, referenceDate = new Date()) {
  const s = String(text || '');
  if (!s.trim()) return null;

  return (
    parseIsoDate(s) ||
    parseNumericDate(s, referenceDate) ||
    parseNamedDate(s, referenceDate) ||
    parseOrdinalDate(s, referenceDate) ||
    parseRelativeAndWeekday(s, referenceDate)
  );
}

export function isDateOnlyLocationCandidate(candidate) {
  const trimmed = String(candidate || '').trim().toLowerCase();
  if (!trimmed) return true;
  if (new RegExp(`^(${WEEKDAY_PATTERN})$`, 'i').test(trimmed)) return true;
  if (/^(today|tomorrow|tonight)$/.test(trimmed)) return true;
  if (/^\d{1,2}(?:st|nd|rd|th)?$/.test(trimmed)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(trimmed)) return true;
  return false;
}

export function userMentionedDate(userText) {
  const s = String(userText || '');
  if (!s.trim()) return false;
  if (inferDateFromText(s, new Date())) return true;
  return new RegExp(
    `\\b(today|tomorrow|tonight|\\d{1,2}(?:st|nd|rd|th)\\b|\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}\\b|\\d{4}-\\d{2}-\\d{2}|next\\s+(?:week|${WEEKDAY_PATTERN})|this\\s+(?:week|weekend|${WEEKDAY_PATTERN})|(?:${WEEKDAY_PATTERN}))\\b`,
    'i'
  ).test(s);
}

export function inferPriceFromText(text) {
  const s = String(text || '');
  if (!s.trim()) return { minPrice: null, maxPrice: null };

  const sizeSuffix = `(?!\\d)(?!\\s*${SIZE_UNIT})`;

  const between = s.match(
    new RegExp(
      `\\bbetween\\s+\\$?(\\d+(?:\\.\\d+)?)${sizeSuffix}\\s+and\\s+\\$?(\\d+(?:\\.\\d+)?)${sizeSuffix}`,
      'i'
    )
  );
  if (between) {
    const { low, high } = normalizeOrderedBounds(between[1], between[2]);
    return { minPrice: low, maxPrice: high };
  }

  const maxMatch = s.match(
    new RegExp(
      `\\b(?:max(?:imum)?|up\\s+to|under|below|less\\s+than|at\\s+most|budget\\s+of|budget)\\s*\\$?(\\d+(?:\\.\\d+)?)${sizeSuffix}`,
      'i'
    )
  );
  if (maxMatch) {
    return { minPrice: null, maxPrice: parseAmount(maxMatch[1]) };
  }

  const minMatch = s.match(
    new RegExp(
      `\\b(?:min(?:imum)?|at\\s+least|from)\\s*\\$?(\\d+(?:\\.\\d+)?)${sizeSuffix}`,
      'i'
    )
  );
  if (minMatch) {
    return { minPrice: parseAmount(minMatch[1]), maxPrice: null };
  }

  const hourlyBare = s.match(
    new RegExp(
      `\\$?(\\d+(?:\\.\\d+)?)${sizeSuffix}(?:\\s*(?:per\\s+hour|an\\s+hour)|\\/(?:hour|hr|h))\\b`,
      'i'
    )
  );
  if (hourlyBare) {
    return { minPrice: null, maxPrice: parseAmount(hourlyBare[1]) };
  }

  const colloquialMax = s.match(/\$?(\d+(?:\.\d+)?)\s*(?:bucks|dollars)\b/i);
  if (colloquialMax) {
    return { minPrice: null, maxPrice: parseAmount(colloquialMax[1]) };
  }

  const euroPrefix = s.match(/€\s*(\d+(?:\.\d+)?)\b/);
  if (euroPrefix) {
    return { minPrice: null, maxPrice: parseAmount(euroPrefix[1]) };
  }

  const euroSuffix = s.match(/\b(\d+(?:\.\d+)?)\s*€\b/);
  if (euroSuffix) {
    return { minPrice: null, maxPrice: parseAmount(euroSuffix[1]) };
  }

  const currencyBare = s.match(/\$\s*(\d+(?:\.\d+)?)\b/);
  if (currencyBare && userMentionedPrice(s)) {
    return { minPrice: null, maxPrice: parseAmount(currencyBare[1]) };
  }

  return { minPrice: null, maxPrice: null };
}

export function userMentionedPrice(userText) {
  const s = String(userText || '');
  if (!s.trim()) return false;
  const inferred = inferPriceFromText(s);
  return inferred.minPrice != null || inferred.maxPrice != null;
}

export function resolvePriceFromMessages(userMessages, searchParams) {
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const text = userMessages[i];
    if (!userMentionedPrice(text)) continue;

    const inferred = inferPriceFromText(text);
    const result = {
      minPrice: inferred.minPrice,
      maxPrice: inferred.maxPrice,
    };

    const minOnlyFromText = inferred.minPrice != null && inferred.maxPrice == null;
    const maxOnlyFromText = inferred.maxPrice != null && inferred.minPrice == null;

    if (result.minPrice == null && searchParams?.minPrice != null && !maxOnlyFromText) {
      result.minPrice = searchParams.minPrice;
    }
    if (result.maxPrice == null && searchParams?.maxPrice != null && !minOnlyFromText) {
      result.maxPrice = searchParams.maxPrice;
    }
    if (result.minPrice == null && result.maxPrice == null) {
      if (searchParams?.minPrice != null) result.minPrice = searchParams.minPrice;
      if (searchParams?.maxPrice != null) result.maxPrice = searchParams.maxPrice;
    }

    return result;
  }

  return { minPrice: null, maxPrice: null };
}

export function inferSizeFromText(text) {
  const s = String(text || '');
  if (!s.trim()) return { minSquareMeters: null, maxSquareMeters: null };

  const sizeUnit = SIZE_UNIT;

  const between = s.match(
    new RegExp(`\\bbetween\\s+(\\d+(?:\\.\\d+)?)\\s+and\\s+(\\d+(?:\\.\\d+)?)\\s*${sizeUnit}\\b`, 'i')
  );
  if (between) {
    const { low, high } = normalizeOrderedBounds(between[1], between[2]);
    return {
      minSquareMeters: parseSizeAmount(String(low)),
      maxSquareMeters: parseSizeAmount(String(high)),
    };
  }

  const maxMatch = s.match(
    new RegExp(
      `\\b(?:max(?:imum)?|up\\s+to|under|below|less\\s+than|at\\s+most)\\s*(\\d+(?:\\.\\d+)?)\\s*${sizeUnit}\\b`,
      'i'
    )
  );
  if (maxMatch) {
    return { minSquareMeters: null, maxSquareMeters: parseSizeAmount(maxMatch[1]) };
  }

  const minMatch = s.match(
    new RegExp(
      `\\b(?:min(?:imum)?|at\\s+least|should\\s+have)\\s*(\\d+(?:\\.\\d+)?)\\s*${sizeUnit}\\b`,
      'i'
    )
  );
  if (minMatch) {
    return { minSquareMeters: parseSizeAmount(minMatch[1]), maxSquareMeters: null };
  }

  const bare = s.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${sizeUnit}\\b`, 'i'));
  if (bare) {
    return { minSquareMeters: parseSizeAmount(bare[1]), maxSquareMeters: null };
  }

  return { minSquareMeters: null, maxSquareMeters: null };
}

export function userMentionedSize(userText) {
  const s = String(userText || '');
  if (!s.trim()) return false;
  if (SIZE_INTENT_RE.test(s)) return true;
  const inferred = inferSizeFromText(s);
  return inferred.minSquareMeters != null || inferred.maxSquareMeters != null;
}

export function resolveSizeFromMessages(userMessages, searchParams) {
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const text = userMessages[i];
    if (!userMentionedSize(text)) continue;

    const inferred = inferSizeFromText(text);
    const result = {
      minSquareMeters: inferred.minSquareMeters,
      maxSquareMeters: inferred.maxSquareMeters,
    };

    const minOnlyFromText = inferred.minSquareMeters != null && inferred.maxSquareMeters == null;
    const maxOnlyFromText = inferred.maxSquareMeters != null && inferred.minSquareMeters == null;

    if (result.minSquareMeters == null && searchParams?.minSquareMeters != null && !maxOnlyFromText) {
      result.minSquareMeters = searchParams.minSquareMeters;
    }
    if (result.maxSquareMeters == null && searchParams?.maxSquareMeters != null && !minOnlyFromText) {
      result.maxSquareMeters = searchParams.maxSquareMeters;
    }
    if (result.minSquareMeters == null && result.maxSquareMeters == null) {
      if (searchParams?.minSquareMeters != null) {
        result.minSquareMeters = searchParams.minSquareMeters;
      }
      if (searchParams?.maxSquareMeters != null) {
        result.maxSquareMeters = searchParams.maxSquareMeters;
      }
    }

    return result;
  }

  return { minSquareMeters: null, maxSquareMeters: null };
}

export function userMentionedSizeInMessages(userMessages) {
  return userMessages.some((text) => userMentionedSize(text));
}

/** Remove price/size filter tails accidentally captured after a place name in location text. */
export function stripFilterTokensFromLocation(candidate) {
  let s = String(candidate || '').trim();
  if (!s) return s;

  s = s.replace(
    new RegExp(`\\s+between\\s+\\d+(?:\\.\\d+)?\\s+and\\s+\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT}\\b`, 'gi'),
    ''
  );
  s = s.replace(
    new RegExp(
      `\\s+(?:max(?:imum)?|min(?:imum)?|at\\s+least|at\\s+most|under|below|less\\s+than)\\s*\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT}\\b`,
      'gi'
    ),
    ''
  );
  s = s.replace(new RegExp(`\\s*\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT}\\b`, 'gi'), '');
  s = s.replace(/\s+between\s+\$?\d+(?:\.\d+)?(?:\s+and\s+\$?\d+(?:\.\d+)?)?\b/gi, '');
  s = s.replace(/\s+between\b/gi, '');
  s = s.replace(
    /\s+(?:max(?:imum)?|min(?:imum)?|budget(?:\s+of)?|under|below|less\s+than|at\s+most|at\s+least|from)\s+\$?\d+(?:\.\d+)?\b/gi,
    ''
  );

  s = s.replace(/\s+\d{4}-\d{2}-\d{2}\b/gi, '');
  s = s.replace(/\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/gi, '');
  s = s.replace(
    new RegExp(
      `\\s+(?:on\\s+|the\\s+)?\\d{1,2}(?:st|nd|rd|th)(?:\\s+of\\s+(?:${MONTH_PATTERN}))?(?:\\s+\\d{4})?\\b`,
      'gi'
    ),
    ''
  );
  s = s.replace(
    new RegExp(`\\s+(?:on\\s+)?(?:${MONTH_PATTERN})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'),
    ''
  );
  s = s.replace(
    new RegExp(
      `\\s+(?:on\\s+)?(?:today|tomorrow|tonight|next\\s+week|this\\s+weekend|next\\s+(?:${WEEKDAY_PATTERN})|this\\s+(?:${WEEKDAY_PATTERN})|(?:${WEEKDAY_PATTERN}))\\b`,
      'gi'
    ),
    ''
  );

  s = s.replace(HOURLY_RATE_RE, '');
  s = s.replace(/\s+\$?\d+(?:\.\d+)?\b/g, '');

  return s
    .replace(
      new RegExp(
        `\\b(?:for|with|that|who|and|or|on)\\b(?=\\s*(?:the\\s+)?\\d{1,2}(?:st|nd|rd|th)|today|tomorrow|tonight|(?:${WEEKDAY_PATTERN})\\b).*`,
        'i'
      ),
      ''
    )
    .replace(/\b(for|with|that|who|and|or)\b.*$/i, '')
    .trim()
    .replace(/[?.!]+$/, '')
    .trim();
}

export function resolveDateFromMessages(userMessages, searchParams, referenceDate) {
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const text = userMessages[i];
    const inferred = inferDateFromText(text, referenceDate);
    if (inferred) return inferred;

    if (userMentionedDate(text) && searchParams?.date) {
      const toolDate = String(searchParams.date).trim();
      if (toolDate) return toolDate;
    }
  }
  return null;
}

export function userMentionedDateInMessages(userMessages) {
  return userMessages.some((text) => userMentionedDate(text));
}
