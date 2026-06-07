import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaType } from '@google/generative-ai';
import { AI_SPACE_CATEGORIES } from '../src/lib/aiSearchPolicy.js';
import { buildSearchParamsForLadder, extractKnownFilters } from '../src/lib/aiSearchPolicy.js';
import {
  normalizeToolArgs,
  parseSearchToolCall,
  SEARCH_SPACES_DECLARATION,
  SEARCH_SPACES_TOOL_NAME,
  SEARCH_SPACES_TOOLS,
} from '../src/lib/aiSearchTools.js';

describe('aiSearchTools', () => {
  it('SEARCH_SPACES_DECLARATION includes category enum and filter properties', () => {
    assert.equal(SEARCH_SPACES_DECLARATION.name, SEARCH_SPACES_TOOL_NAME);
    const props = SEARCH_SPACES_DECLARATION.parameters.properties;
    assert.deepEqual(props.category.enum, AI_SPACE_CATEGORIES);
    assert.equal(props.location.type, SchemaType.STRING);
    assert.equal(props.minPrice.type, SchemaType.NUMBER);
    assert.equal(props.amenities.type, SchemaType.ARRAY);
    assert.ok(Array.isArray(SEARCH_SPACES_TOOLS[0].functionDeclarations));
  });

  it('normalizeToolArgs coerces numbers and filters amenities', () => {
    const normalized = normalizeToolArgs({
      location: ' Craiova ',
      category: 'Art Studio',
      minPrice: '50',
      maxPrice: 120,
      amenities: ['wifi', 'not-real', 'parking'],
      minCapacity: '10',
    });
    assert.equal(normalized.location, 'Craiova');
    assert.equal(normalized.category, 'Art Studio');
    assert.equal(normalized.minPrice, 50);
    assert.equal(normalized.maxPrice, 120);
    assert.equal(normalized.minCapacity, 10);
    assert.deepEqual(normalized.amenities, ['wifi', 'parking']);
  });

  it('normalizeToolArgs rejects invalid category', () => {
    const normalized = normalizeToolArgs({
      location: 'Romania',
      category: 'Painting Studio',
    });
    assert.equal(normalized.category, null);
    assert.equal(normalized.location, 'Romania');
  });

  it('parseSearchToolCall extracts search_spaces args', () => {
    const response = {
      functionCalls: () => [
        {
          name: 'search_spaces',
          args: {
            location: 'Romania',
            category: 'Art Studio',
            amenities: ['wifi'],
          },
        },
      ],
    };
    const { searchParams, toolUsed } = parseSearchToolCall(response);
    assert.equal(toolUsed, true);
    assert.equal(searchParams.location, 'Romania');
    assert.equal(searchParams.category, 'Art Studio');
    assert.deepEqual(searchParams.amenities, ['wifi']);
  });

  it('parseSearchToolCall ignores non-search_spaces calls', () => {
    const response = {
      functionCalls: () => [{ name: 'other_tool', args: { location: 'Paris' } }],
    };
    const { searchParams, toolUsed } = parseSearchToolCall(response);
    assert.equal(toolUsed, false);
    assert.equal(searchParams, null);
  });

  it('parseSearchToolCall handles empty or missing functionCalls', () => {
    assert.deepEqual(parseSearchToolCall(null), { searchParams: null, toolUsed: false });
    assert.deepEqual(parseSearchToolCall({ functionCalls: () => [] }), {
      searchParams: null,
      toolUsed: false,
    });
    assert.deepEqual(
      parseSearchToolCall({ functionCalls: () => { throw new Error('blocked'); } }),
      { searchParams: null, toolUsed: false }
    );
  });

  it('buildSearchParamsForLadder preserves user-trusted location over tool args', () => {
    const messages = [
      { role: 'user', content: 'art studio anywhere in dolj' },
    ];
    const toolParams = normalizeToolArgs({
      location: 'Bucharest',
      category: 'Art Studio',
    });
    const knownFilters = extractKnownFilters(messages, toolParams);
    const ladderParams = buildSearchParamsForLadder(knownFilters, toolParams);
    assert.equal(ladderParams.location, 'dolj');
    assert.equal(ladderParams.category, 'Art Studio');
  });
});
