import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AMENITY_ID_TO_LABELS } from '../src/lib/amenities.js';
import {
  AMENITY_USER_PATTERNS,
  buildClarifyMessage,
  buildCloseMatchSteps,
  buildFollowUpHint,
  buildResultMessage,
  classifySearchResult,
  computeMissingRefinements,
  countRefinementFilters,
  extractKnownFilters,
  hasEnoughForCards,
  inferAmenityIdsFromText,
  inferCategoryFromText,
  inferLocationFromText,
  isSpecificCity,
  parseAnywhereInLocation,
  rankSpacesByAmenityOverlap,
  buildSearchParamsForLadder,
  cardsSatisfyKnownFilters,
  missingForCards,
  shouldSuggestFollowUp,
  userHasVagueLocationIntent,
} from '../src/lib/aiSearchPolicy.js';

describe('aiSearchPolicy', () => {
  it('AMENITY_USER_PATTERNS covers every canonical amenity id', () => {
    const patternIds = new Set(AMENITY_USER_PATTERNS.map((p) => p.id));
    for (const id of Object.keys(AMENITY_ID_TO_LABELS)) {
      assert.ok(patternIds.has(id), `missing pattern for amenity id: ${id}`);
    }
    assert.equal(patternIds.size, Object.keys(AMENITY_ID_TO_LABELS).length);
  });

  it('inferCategoryFromText maps paint and art studio', () => {
    assert.equal(inferCategoryFromText('I want to paint'), 'Art Studio');
    assert.equal(inferCategoryFromText('find me an art studio'), 'Art Studio');
    assert.equal(inferCategoryFromText('Looking to record a podcast'), 'Recording Studio');
    assert.equal(inferCategoryFromText('I want to cook'), 'Kitchen Studio');
    assert.equal(inferCategoryFromText('I want to shoot photos'), 'Photo Studio');
    assert.equal(inferCategoryFromText('I want to do yoga'), 'Sports Space');
    assert.equal(inferCategoryFromText('actually i want it in craiova'), null);
  });

  it('activity intents ask only for location on clarify (cook parity with paint)', () => {
    const paintOnly = extractKnownFilters(
      [{ role: 'user', content: 'I want to paint' }],
      null
    );
    assert.deepEqual(missingForCards(paintOnly), ['location']);

    const cookOnly = extractKnownFilters(
      [{ role: 'user', content: 'I want to cook' }],
      null
    );
    assert.deepEqual(missingForCards(cookOnly), ['location']);
    assert.equal(cookOnly.category, 'Kitchen Studio');
  });

  it('inferCategoryFromText natural phrasing (D1.1)', () => {
    assert.equal(inferCategoryFromText('I want to do pilates'), 'Sports Space');
    assert.equal(inferCategoryFromText('i want to go to a gym'), 'Sports Space');
    assert.equal(inferCategoryFromText('I want to make photos'), 'Photo Studio');
    assert.equal(inferCategoryFromText('Looking to record something'), 'Recording Studio');
    assert.equal(inferCategoryFromText('I want to make pasta'), 'Kitchen Studio');
    assert.equal(
      inferCategoryFromText('im a programmer, looking for a space to do my job'),
      'IT Classroom'
    );
    assert.equal(inferCategoryFromText('I want to make music'), 'Recording Studio');
    assert.equal(inferCategoryFromText('I want to rehearse in romania'), null);
    assert.equal(inferCategoryFromText('I want to rehearse a dance in Craiova'), 'Dancing Studio');
  });

  it('D1.1 clarify: make photos asks location; bare rehearse with location asks type', () => {
    const makePhotos = extractKnownFilters(
      [{ role: 'user', content: 'I want to make photos' }],
      null
    );
    assert.deepEqual(missingForCards(makePhotos), ['location']);
    assert.equal(makePhotos.category, 'Photo Studio');

    const rehearseRomania = extractKnownFilters(
      [{ role: 'user', content: 'I want to rehearse in romania' }],
      null
    );
    assert.deepEqual(missingForCards(rehearseRomania), ['category']);
    assert.equal(rehearseRomania.category, null);
    assert.match(String(rehearseRomania.location), /romania/i);
  });

  it('hasEnoughForCards requires location and category', () => {
    const enough = extractKnownFilters(
      [{ role: 'user', content: 'art studio in Romania' }],
      null
    );
    assert.equal(hasEnoughForCards(enough), true);

    const noLocation = extractKnownFilters(
      [{ role: 'user', content: 'I want to paint' }],
      null
    );
    assert.equal(hasEnoughForCards(noLocation), false);
    assert.deepEqual(missingForCards(noLocation), ['location']);
  });

  it('bare anywhere does not count as location', () => {
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'I want an art studio anywhere' }],
      { location: 'Craiova, Romania', category: 'Art Studio' }
    );
    assert.equal(userHasVagueLocationIntent('I want an art studio anywhere'), true);
    assert.equal(hasEnoughForCards(filters), false);
    assert.deepEqual(missingForCards(filters), ['location']);
  });

  it('anywhere in dolj counts as location Dolj', () => {
    assert.equal(parseAnywhereInLocation('I want to paint anywhere in dolj'), 'dolj');
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'I want to paint anywhere in dolj' }],
      { category: 'Art Studio' }
    );
    assert.equal(filters.location, 'dolj');
    assert.equal(filters.category, 'Art Studio');
    assert.equal(hasEnoughForCards(filters), true);
  });

  it('laboratory in rome with parking infers amenities for strict then close match', () => {
    const userText = 'i want a laboratory space in rome that has on site parking';
    assert.deepEqual(inferAmenityIdsFromText(userText), ['parking']);
    const filters = extractKnownFilters(
      [{ role: 'user', content: userText }],
      { location: 'Rome', category: 'Laboratory', amenities: ['parking'] }
    );
    assert.equal(filters.location, 'Rome');
    assert.equal(filters.category, 'Laboratory');
    assert.deepEqual(filters.amenities, ['parking']);
    assert.equal(filters.date, null);

    const ladder = buildSearchParamsForLadder(filters, {
      location: 'Rome',
      category: 'Laboratory',
      amenities: ['parking'],
      date: '2026-12-01',
    });
    assert.equal(ladder.date, null);
    assert.deepEqual(ladder.amenities, ['parking']);

    const steps = buildCloseMatchSteps(ladder);
    assert.deepEqual(steps[0].amenities, ['parking']);
    assert.deepEqual(steps[1].amenities, []);
    assert.equal(steps[1].location, 'Rome');
    assert.equal(steps[1].category, 'Laboratory');
  });

  it('inferLocationFromText never returns vague or missing locations', () => {
    assert.equal(inferLocationFromText('I want an art studio'), null);
    assert.equal(inferLocationFromText('art studio anywhere'), null);
    assert.equal(inferLocationFromText('art studio in Romania'), 'Romania');
  });

  it('extractKnownFilters only trusts search location mentioned by user', () => {
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'art studio in Romania' }],
      { location: 'Brooklyn, NY', category: 'Art Studio' }
    );
    assert.equal(filters.location, 'Romania');
    assert.equal(filters.category, 'Art Studio');
  });

  it('extractKnownFilters merges trusted SEARCH params', () => {
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'art studio in Romania under $50' }],
      { location: 'Romania', category: 'Art Studio', minPrice: 50 }
    );
    assert.equal(filters.location, 'Romania');
    assert.equal(filters.category, 'Art Studio');
    assert.equal(filters.maxPrice, 50);
    assert.equal(filters.minPrice, null);
  });

  it('isSpecificCity distinguishes city from country and region', () => {
    assert.equal(isSpecificCity('Craiova, Romania'), true);
    assert.equal(isSpecificCity('Craiova'), true);
    assert.equal(isSpecificCity('Romania'), false);
    assert.equal(isSpecificCity('dolj'), false);
    assert.equal(isSpecificCity('Brooklyn, NY'), true);
  });

  it('anywhere in dolj keeps regional scope for follow-up city prompt', () => {
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'give me a space to paint anywhere in dolj' }],
      { category: 'Art Studio', location: 'dolj' }
    );
    assert.equal(filters.regionalLocationScope, true);
    assert.equal(isSpecificCity('dolj', filters), false);
    assert.ok(computeMissingRefinements(filters).includes('specificCity'));
  });

  it('anywhere in craiova is a specific city for follow-up', () => {
    const filters = extractKnownFilters(
      [{ role: 'user', content: 'i want to paint anywhere in craiova' }],
      { category: 'Art Studio', location: 'craiova' }
    );
    assert.equal(filters.location, 'craiova');
    assert.equal(filters.regionalLocationScope, false);
    assert.equal(isSpecificCity('craiova', filters), true);
    assert.ok(!computeMissingRefinements(filters).includes('specificCity'));
  });

  it('latest user message location overrides earlier anywhere in region', () => {
    const filters = extractKnownFilters(
      [
        { role: 'user', content: 'i want an art studio anywhere in dolj' },
        { role: 'user', content: 'actually i want it in craiova' },
      ],
      { location: 'Craiova', category: 'Art Studio' }
    );
    assert.match(String(filters.location), /craiova/i);
    assert.equal(filters.regionalLocationScope, false);
    assert.equal(filters.category, 'Art Studio');
  });

  it('infers coffee and natural light amenities from user text', () => {
    const userText = 'i want an art studio with free coffee and natural light in craiova';
    assert.deepEqual(inferAmenityIdsFromText(userText).sort(), ['coffee', 'light']);
    const filters = extractKnownFilters(
      [{ role: 'user', content: userText }],
      { location: 'Craiova', category: 'Art Studio', amenities: ['coffee', 'light'] }
    );
    assert.deepEqual(filters.amenities?.sort(), ['coffee', 'light']);
  });

  it('infers additional amenity phrases from catalog labels and colloquial synonyms (D4)', () => {
    assert.ok(inferAmenityIdsFromText('need air conditioning and a projector').includes('ac'));
    assert.ok(inferAmenityIdsFromText('need air conditioning and a projector').includes('projector'));
    assert.ok(inferAmenityIdsFromText('with green screen and video conferencing').includes('green'));
    assert.ok(inferAmenityIdsFromText('with green screen and video conferencing').includes('conferencing'));
    assert.ok(inferAmenityIdsFromText('with good sound system').includes('audio'));
    assert.ok(inferAmenityIdsFromText('photo studio with lighting').includes('light'));
    assert.ok(inferAmenityIdsFromText('It classroom with wifi in romania').includes('wifi'));
    assert.ok(
      inferAmenityIdsFromText('art studio in romania with a place to park my car').includes('parking')
    );
  });

  it('rankSpacesByAmenityOverlap prefers more matching amenities then retrieval', () => {
    const spaces = [
      { id: 'a', amenities: [{ amenityId: 'light' }] },
      { id: 'b', amenities: [{ amenityId: 'coffee' }, { amenityId: 'light' }] },
      { id: 'c', amenities: [{ amenityId: 'coffee' }] },
    ];
    const retrieved = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
    const ranked = rankSpacesByAmenityOverlap(spaces, ['coffee', 'light'], retrieved);
    assert.deepEqual(ranked.map((s) => s.id), ['b', 'c', 'a']);
  });

  it('countRefinementFilters counts date, budget, capacity, size, amenities', () => {
    assert.equal(
      countRefinementFilters({
        date: '2026-06-10',
        minPrice: 50,
        minCapacity: 10,
      }),
      3
    );
    assert.equal(
      countRefinementFilters({
        date: '2026-06-10',
        maxPrice: 100,
        minSquareMeters: 50,
        amenities: ['wifi'],
      }),
      4
    );
  });

  it('shouldSuggestFollowUp is false when specific city and 2+ refinements', () => {
    const broad = {
      location: 'Romania',
      category: 'Art Studio',
    };
    assert.equal(shouldSuggestFollowUp(broad), true);

    const narrow = {
      location: 'Craiova, Romania',
      category: 'Art Studio',
      date: '2026-06-10',
      minPrice: 50,
    };
    assert.equal(shouldSuggestFollowUp(narrow), false);

    const singleCity = {
      location: 'Craiova',
      category: 'Art Studio',
      date: '2026-06-10',
      minPrice: 50,
    };
    assert.equal(shouldSuggestFollowUp(singleCity), false);
  });

  it('buildFollowUpHint uses commas and single or before catch-all', () => {
    const hint = buildFollowUpHint(['specificCity', 'date', 'budget']);
    assert.match(hint, /specific city/);
    assert.match(hint, /date you wish to book/);
    assert.match(hint, /budget/);
    assert.doesNotMatch(hint, /how many people/);

    const multi = buildFollowUpHint(['specificCity', 'capacity', 'size', 'amenities']);
    assert.match(multi, /a specific city, how many people will join, how much space you need, any amenities you need, or anything else/);
    assert.doesNotMatch(multi, /amenities you need, or any amenities/);

    const missing = computeMissingRefinements({
      location: 'Craiova, Romania',
      category: 'Art Studio',
    });
    assert.ok(!missing.includes('specificCity'));
    assert.ok(missing.includes('date'));
    assert.equal(buildFollowUpHint([]), '');
  });

  it('buildClarifyMessage asks only for missing pieces', () => {
    assert.match(buildClarifyMessage(['location']), /Where/i);
    assert.match(buildClarifyMessage(['category']), /type of space/i);
    assert.match(buildClarifyMessage(['location', 'category']), /what type/i);
    assert.match(buildClarifyMessage(['location', 'category']), /where/i);
  });

  it('buildResultMessage returns exact, close, and none copy', () => {
    assert.match(buildResultMessage('exact'), /Here is what I think you would like/);
    assert.match(buildResultMessage('close', 2), /closest matches/);
    assert.match(buildResultMessage('close', 1), /closest match:/);
    assert.match(buildResultMessage('none'), /no spaces that match your criteria/);
  });

  it('classifySearchResult maps strict and relaxed sources', () => {
    assert.equal(classifySearchResult(3, null), 'exact');
    assert.equal(classifySearchResult(0, 'relaxed'), 'close');
    assert.equal(classifySearchResult(0, 'rag'), 'none');
    assert.equal(classifySearchResult(0, null), 'none');
  });

  it('cardsSatisfyKnownFilters rejects cards outside price and size bounds', () => {
    const knownFilters = { maxPrice: 75, minSquareMeters: 3 };
    assert.equal(
      cardsSatisfyKnownFilters(
        [{ price: 75, squareMeters: 4 }, { price: 50, squareMeters: 3 }],
        knownFilters
      ),
      true
    );
    assert.equal(
      cardsSatisfyKnownFilters([{ price: 76, squareMeters: 4 }], knownFilters),
      false
    );
    assert.equal(
      cardsSatisfyKnownFilters([{ price: 50, squareMeters: 2 }], knownFilters),
      false
    );
    assert.equal(
      cardsSatisfyKnownFilters([{ price: 50, squareMeters: null }], knownFilters),
      false
    );
  });

  it('cardsSatisfyKnownFilters rejects cards missing inferred amenities (D4.1)', () => {
    const knownFilters = { amenities: ['wifi'] };
    assert.equal(
      cardsSatisfyKnownFilters([{ amenities: ['wifi', 'parking'] }], knownFilters),
      true
    );
    assert.equal(
      cardsSatisfyKnownFilters([{ amenities: ['parking'] }], knownFilters),
      false
    );
  });

  it('buildSearchParamsForLadder applies inferred price and size from knownFilters', () => {
    const knownFilters = extractKnownFilters(
      [{ role: 'user', content: 'art studio in Craiova 50 an hour with 3 sqm' }],
      null
    );
    const ladderParams = buildSearchParamsForLadder(knownFilters, {
      maxPrice: 100,
      maxSquareMeters: 3,
    });
    assert.equal(ladderParams.maxPrice, 50);
    assert.equal(ladderParams.minSquareMeters, 3);
    assert.equal(ladderParams.maxSquareMeters, null);
  });

  it('buildCloseMatchSteps preserves category and location at every step', () => {
    const steps = buildCloseMatchSteps({
      location: 'Antarctica',
      category: 'Sports Space',
      amenities: ['gym'],
      minPrice: 50,
      minCapacity: 10,
      date: '2026-06-10',
    });
    assert.equal(steps.length, 5);
    for (const step of steps) {
      assert.equal(step.location, 'Antarctica');
      assert.equal(step.category, 'Sports Space');
      assert.equal(step.date, '2026-06-10');
    }
    assert.deepEqual(steps[0].amenities, ['gym']);
    assert.deepEqual(steps[1].amenities, []);
    assert.equal(steps[2].minPrice, null);
    assert.equal(steps[3].minCapacity, null);
    assert.equal(steps[4].minSquareMeters, null);
  });
});
