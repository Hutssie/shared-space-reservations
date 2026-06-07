import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferDateFromText,
  inferPriceFromText,
  inferSizeFromText,
  resolveDateFromMessages,
  resolvePriceFromMessages,
  resolveSizeFromMessages,
  stripFilterTokensFromLocation,
  userMentionedDate,
  userMentionedPrice,
  userMentionedSize,
} from '../src/lib/aiSearchFilterInference.js';
import {
  AI_SPACE_CATEGORIES,
  CATEGORY_ACTIVITY_PATTERNS,
  CATEGORY_INTENT_PHRASES,
  extractKnownFilters,
  inferCategoryFromText,
  inferLocationFromText,
} from '../src/lib/aiSearchPolicy.js';

const REFERENCE = new Date('2026-06-04T12:00:00');

describe('aiSearchFilterInference', () => {
  it('inferPriceFromText parses max, hourly, between, and budget phrases', () => {
    assert.deepEqual(inferPriceFromText('art studio max 50 per hour'), {
      minPrice: null,
      maxPrice: 50,
    });
    assert.deepEqual(inferPriceFromText('under $80'), { minPrice: null, maxPrice: 80 });
    assert.deepEqual(inferPriceFromText('50 per hour'), { minPrice: null, maxPrice: 50 });
    assert.deepEqual(inferPriceFromText('between 20 and 80'), {
      minPrice: 20,
      maxPrice: 80,
    });
    assert.deepEqual(inferPriceFromText('at least 30'), { minPrice: 30, maxPrice: null });
    assert.deepEqual(inferPriceFromText('budget 100'), { minPrice: null, maxPrice: 100 });
    assert.deepEqual(inferPriceFromText('art studio in Craiova 50 an hour'), {
      minPrice: null,
      maxPrice: 50,
    });
    assert.deepEqual(inferPriceFromText('50 bucks'), { minPrice: null, maxPrice: 50 });
    assert.deepEqual(inferPriceFromText('max 75'), { minPrice: null, maxPrice: 75 });
    assert.deepEqual(inferPriceFromText('€50'), { minPrice: null, maxPrice: 50 });
    assert.deepEqual(inferPriceFromText('art studio in Craiova 50/hour'), {
      minPrice: null,
      maxPrice: 50,
    });
    assert.deepEqual(inferPriceFromText('between 100 and 20'), {
      minPrice: 20,
      maxPrice: 100,
    });
    assert.deepEqual(inferPriceFromText('no price here'), { minPrice: null, maxPrice: null });
  });

  it('inferPriceFromText ignores size phrases (no price/size cross-contamination)', () => {
    assert.deepEqual(inferPriceFromText('art studio in dolj max 50 sqm'), {
      minPrice: null,
      maxPrice: null,
    });
    assert.deepEqual(inferPriceFromText('between 40 and 1 sqm'), {
      minPrice: null,
      maxPrice: null,
    });
    assert.deepEqual(inferPriceFromText('art studio in dolj between 1 and 40 sqm'), {
      minPrice: null,
      maxPrice: null,
    });
    assert.deepEqual(inferPriceFromText('at least 3 sqm'), {
      minPrice: null,
      maxPrice: null,
    });
    assert.equal(userMentionedPrice('max 50 sqm'), false);
    assert.equal(userMentionedPrice('max 50 per hour'), true);
  });

  it('inferSizeFromText parses minimum, maximum, and between size phrases', () => {
    assert.deepEqual(inferSizeFromText('3 square meters'), {
      minSquareMeters: 3,
      maxSquareMeters: null,
    });
    assert.deepEqual(inferSizeFromText('at least 3 sqm'), {
      minSquareMeters: 3,
      maxSquareMeters: null,
    });
    assert.deepEqual(inferSizeFromText('max 50 sqm'), {
      minSquareMeters: null,
      maxSquareMeters: 50,
    });
    assert.deepEqual(inferSizeFromText('between 20 and 40 sqm'), {
      minSquareMeters: 20,
      maxSquareMeters: 40,
    });
    assert.deepEqual(inferSizeFromText('3 meters square'), {
      minSquareMeters: 3,
      maxSquareMeters: null,
    });
    assert.deepEqual(inferSizeFromText('between 40 and 1 sqm'), {
      minSquareMeters: 1,
      maxSquareMeters: 40,
    });
    assert.deepEqual(inferSizeFromText('art studio only'), {
      minSquareMeters: null,
      maxSquareMeters: null,
    });
  });

  it('userMentionedPrice detects hourly and max phrasing', () => {
    assert.equal(userMentionedPrice('max 50 per hour'), true);
    assert.equal(userMentionedPrice('50 per hour'), true);
    assert.equal(userMentionedPrice('art studio in Craiova'), false);
  });

  it('inferDateFromText parses relative, named, and numeric dates', () => {
    assert.equal(inferDateFromText('tomorrow', REFERENCE), '2026-06-05');
    assert.equal(inferDateFromText('today', REFERENCE), '2026-06-04');
    assert.equal(inferDateFromText('June 15', REFERENCE), '2026-06-15');
    assert.equal(inferDateFromText('15/06/2026', REFERENCE), '2026-06-15');
    assert.equal(inferDateFromText('next Monday', REFERENCE), '2026-06-08');
    assert.equal(inferDateFromText('2026-12-01', REFERENCE), '2026-12-01');
  });

  it('inferDateFromText parses ordinals and EU dot dates (D3)', () => {
    assert.equal(inferDateFromText('on 15th', REFERENCE), '2026-06-15');
    assert.equal(inferDateFromText('the 15th', REFERENCE), '2026-06-15');
    assert.equal(inferDateFromText('15.06.2026', REFERENCE), '2026-06-15');
    assert.equal(inferDateFromText('art studio in craiova on tuesday', REFERENCE), '2026-06-09');
  });

  it('userMentionedDate detects named calendar phrases', () => {
    assert.equal(userMentionedDate('on June 15'), true);
    assert.equal(userMentionedDate('on 15th'), true);
    assert.equal(userMentionedDate('15.06.2026'), true);
    assert.equal(userMentionedDate('art studio only'), false);
  });

  it('resolvePriceFromMessages uses latest price-bearing turn only', () => {
    const replaced = resolvePriceFromMessages(
      ['between 20 and 74', 'budget 75'],
      null
    );
    assert.deepEqual(replaced, { minPrice: null, maxPrice: 75 });

    const retained = resolvePriceFromMessages(
      ['max 50 per hour', 'in Bucharest'],
      null
    );
    assert.equal(retained.maxPrice, 50);
    assert.equal(retained.minPrice, null);
  });

  it('resolveSizeFromMessages uses latest size-bearing turn only', () => {
    const latest = resolveSizeFromMessages(['at least 10 sqm', '3 square meters'], null);
    assert.deepEqual(latest, { minSquareMeters: 3, maxSquareMeters: null });
  });

  it('stripFilterTokensFromLocation removes captured price and size tails', () => {
    assert.equal(stripFilterTokensFromLocation('Craiova between 20 and 74'), 'Craiova');
    assert.equal(stripFilterTokensFromLocation('dolj max 50 sqm'), 'dolj');
    assert.equal(stripFilterTokensFromLocation('Craiova 50 an hour'), 'Craiova');
  });

  it('stripFilterTokensFromLocation removes date and weekday tails (D3)', () => {
    assert.equal(stripFilterTokensFromLocation('Craiova on tuesday'), 'Craiova');
    assert.equal(stripFilterTokensFromLocation('dolj tomorrow'), 'dolj');
    assert.equal(stripFilterTokensFromLocation('Craiova on 15th'), 'Craiova');
    assert.equal(stripFilterTokensFromLocation('Craiova 15.06.2026'), 'Craiova');
  });

  it('resolveDateFromMessages uses newest turn and tool fallback', () => {
    const inferred = resolveDateFromMessages(
      ['art studio tomorrow'],
      null,
      REFERENCE
    );
    assert.equal(inferred, '2026-06-05');

    const toolFallback = resolveDateFromMessages(
      ['art studio on June 15'],
      { date: '2026-06-15' },
      REFERENCE
    );
    assert.equal(toolFallback, '2026-06-15');
  });
});

describe('aiSearchFilterInference policy integration', () => {
  it('extractKnownFilters infers price and date from user text without tool params', () => {
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'art studio in Craiova max 50 per hour on June 15' }],
      null,
      { referenceDate: REFERENCE }
    );
    assert.equal(filters.maxPrice, 50);
    assert.equal(filters.date, '2026-06-15');
    assert.equal(filters.category, 'Art Studio');
  });

  it('extractKnownFilters infers colloquial price and minimum size from user text', () => {
    const priceFilters = extractKnownFilters(
      [{ role: 'user', content: 'art studio in Craiova 50 an hour' }],
      { maxPrice: 75 },
      { referenceDate: REFERENCE }
    );
    assert.equal(priceFilters.maxPrice, 50);
    assert.equal(priceFilters.category, 'Art Studio');

    const sizeFilters = extractKnownFilters(
      [{ role: 'user', content: 'art studio in Craiova 3 square meters' }],
      { maxSquareMeters: 3 },
      { referenceDate: REFERENCE }
    );
    assert.equal(sizeFilters.minSquareMeters, 3);
    assert.equal(sizeFilters.maxSquareMeters, null);
  });

  it('extractKnownFilters ignores invented tool price and size when user did not mention them', () => {
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'art studio in Craiova' }],
      { location: 'Craiova', category: 'Art Studio', maxPrice: 75, maxSquareMeters: 3 },
      { referenceDate: REFERENCE }
    );
    assert.equal(filters.maxPrice, null);
    assert.equal(filters.minSquareMeters, null);
    assert.equal(filters.maxSquareMeters, null);
    assert.equal(userMentionedPrice('art studio in Craiova'), false);
    assert.equal(userMentionedSize('art studio in Craiova'), false);
  });

  it('extractKnownFilters strips invented tool date when user never mentioned date', () => {
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'art studio in Romania' }],
      { location: 'Romania', category: 'Art Studio', date: '2026-12-01' },
      { referenceDate: REFERENCE }
    );
    assert.equal(filters.date, null);
  });

  it('category patterns cover every canonical category', () => {
    const covered = new Set([
      ...CATEGORY_ACTIVITY_PATTERNS.map((p) => p.category),
      ...CATEGORY_INTENT_PHRASES.map((p) => p.category),
    ]);
    for (const cat of AI_SPACE_CATEGORIES) {
      assert.ok(covered.has(cat), `missing category pattern for: ${cat}`);
    }
  });

  it('infers category from intent phrases without false positives', () => {
    assert.equal(inferCategoryFromText('i want a photoshoot in Craiova'), 'Photo Studio');
    assert.equal(inferCategoryFromText('voice over session in Bucharest'), 'Recording Studio');
    assert.equal(inferCategoryFromText('I want to shoot photos'), 'Photo Studio');
    assert.equal(inferCategoryFromText('actually i want it in craiova'), null);
    assert.equal(inferCategoryFromText('for the record'), null);
    const filters = extractKnownFilters(
      [
        { role: 'user', content: 'i want an art studio anywhere in dolj' },
        { role: 'user', content: 'actually i want it in craiova' },
      ],
      { location: 'Craiova', category: 'Art Studio' },
      { referenceDate: REFERENCE }
    );
    assert.equal(filters.category, 'Art Studio');
    assert.match(String(filters.location), /craiova/i);
  });

  it('retains category from earlier turn when latest turn only adds location', () => {
    const filters = extractKnownFilters(
      [
        { role: 'user', content: 'I want to cook' },
        { role: 'user', content: 'in Craiova' },
      ],
      { location: 'Craiova', category: 'Kitchen Studio' },
      { referenceDate: REFERENCE }
    );
    assert.equal(filters.category, 'Kitchen Studio');
    assert.match(String(filters.location), /craiova/i);
  });

  it('multi-turn budget replaces range and keeps clean location', () => {
    assert.equal(
      inferLocationFromText('art studio in Craiova between 20 and 74'),
      'Craiova'
    );
    const filters = extractKnownFilters(
      [
        { role: 'user', content: 'art studio in Craiova between 20 and 74' },
        { role: 'user', content: 'budget 75' },
      ],
      null,
      { referenceDate: REFERENCE }
    );
    assert.match(String(filters.location), /craiova/i);
    assert.equal(filters.maxPrice, 75);
    assert.equal(filters.minPrice, null);
  });

  it('extractKnownFilters uses size-only filters for dolj sqm queries (no spurious price)', () => {
    const cases = [
      {
        query: 'art studio in dolj between 40 and 1 sqm',
        minSquareMeters: 1,
        maxSquareMeters: 40,
      },
      {
        query: 'art studio in dolj between 1 and 40 sqm',
        minSquareMeters: 1,
        maxSquareMeters: 40,
      },
      {
        query: 'art studio in dolj max 50 sqm',
        minSquareMeters: null,
        maxSquareMeters: 50,
      },
    ];
    for (const { query, minSquareMeters, maxSquareMeters } of cases) {
      const filters = extractKnownFilters([{ role: 'user', content: query }], null, {
        referenceDate: REFERENCE,
      });
      assert.equal(filters.category, 'Art Studio');
      assert.match(String(filters.location), /dolj/i);
      assert.equal(filters.minPrice, null, query);
      assert.equal(filters.maxPrice, null, query);
      assert.equal(filters.minSquareMeters, minSquareMeters, query);
      assert.equal(filters.maxSquareMeters, maxSquareMeters, query);
    }
  });

  it('clears prior price when latest turn restates category without price', () => {
    const filters = extractKnownFilters(
      [
        { role: 'user', content: 'art studio in craiova max 50 per hour' },
        { role: 'user', content: 'art studio in Craiova' },
      ],
      null,
      { referenceDate: REFERENCE }
    );
    assert.equal(filters.category, 'Art Studio');
    assert.match(String(filters.location), /craiova/i);
    assert.equal(filters.minPrice, null);
    assert.equal(filters.maxPrice, null);
  });

  it('extractKnownFilters parses combined location and date without polluting location (D3)', () => {
    const tuesday = extractKnownFilters(
      [{ role: 'user', content: 'art studio in craiova on tuesday' }],
      null,
      { referenceDate: REFERENCE }
    );
    assert.equal(tuesday.category, 'Art Studio');
    assert.match(String(tuesday.location), /^craiova$/i);
    assert.equal(tuesday.date, '2026-06-09');

    const tomorrow = extractKnownFilters(
      [{ role: 'user', content: 'art studio anywhere in dolj tomorrow' }],
      null,
      { referenceDate: REFERENCE }
    );
    assert.match(String(tomorrow.location), /^dolj$/i);
    assert.equal(tomorrow.date, '2026-06-05');
  });

  it('clears prior date when latest turn fully restates search without date (D3)', () => {
    const filters = extractKnownFilters(
      [
        { role: 'user', content: 'art studio in craiova on tuesday' },
        { role: 'user', content: 'art studio in Craiova' },
      ],
      null,
      { referenceDate: REFERENCE }
    );
    assert.equal(filters.date, null);
    assert.match(String(filters.location), /craiova/i);
  });

  it('retains date from clarify flow when latest turn only adds category (D3)', () => {
    const filters = extractKnownFilters(
      [
        { role: 'user', content: 'anywhere in dolj tomorrow' },
        { role: 'user', content: 'i want to paint' },
      ],
      null,
      { referenceDate: REFERENCE }
    );
    assert.equal(filters.category, 'Art Studio');
    assert.match(String(filters.location), /dolj/i);
    assert.equal(filters.date, '2026-06-05');
  });

  it('retains date from clarify flow when latest turn adds category and location (D3)', () => {
    const filters = extractKnownFilters(
      [
        { role: 'user', content: 'on monday' },
        { role: 'user', content: 'art studio in dolj' },
      ],
      null,
      { referenceDate: REFERENCE }
    );
    assert.equal(filters.category, 'Art Studio');
    assert.match(String(filters.location), /dolj/i);
    assert.equal(filters.date, '2026-06-08');
  });

  it('retains location and updates date on follow-up ordinal (D3)', () => {
    const filters = extractKnownFilters(
      [
        { role: 'user', content: 'art studio in craiova' },
        { role: 'user', content: 'on 15th' },
      ],
      null,
      { referenceDate: REFERENCE }
    );
    assert.match(String(filters.location), /craiova/i);
    assert.equal(filters.date, '2026-06-15');
  });
});
