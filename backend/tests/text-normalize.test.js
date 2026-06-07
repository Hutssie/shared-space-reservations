import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  foldDiacritics,
  locationMentionMatches,
  locationNormExactMatch,
  locationNormFromDisplay,
  normalizeForSearch,
} from '../src/lib/textNormalize.js';

describe('textNormalize', () => {
  it('foldDiacritics handles Romanian and general Latin accents', () => {
    assert.equal(foldDiacritics('Băilești'), 'Bailesti');
    assert.equal(foldDiacritics('Brașov'), 'Brasov');
    assert.equal(foldDiacritics('Târgu Jiu'), 'Targu Jiu');
    assert.equal(foldDiacritics('München'), 'Munchen');
    assert.equal(foldDiacritics(''), '');
  });

  it('normalizeForSearch lowercases and collapses whitespace', () => {
    assert.equal(normalizeForSearch('  Băilești,  Dolj  '), 'bailesti, dolj');
    assert.equal(locationNormFromDisplay('Craiova'), 'craiova');
  });

  it('locationNormExactMatch matches whole comma segments only', () => {
    assert.equal(locationNormExactMatch('bailesti, dolj', 'bailesti'), true);
    assert.equal(locationNormExactMatch('craiova, romania', 'romania'), true);
    assert.equal(locationNormExactMatch('craiova, romania', 'craiova'), true);
    assert.equal(locationNormExactMatch('craiova, romania', 'roma'), false);
    assert.equal(locationNormExactMatch('craiova, romania', 'rome'), false);
    assert.equal(locationNormExactMatch('rome, italy', 'rome'), true);
    assert.equal(locationNormExactMatch('roma, italy', 'roma'), true);
  });

  it('locationMentionMatches is diacritic-insensitive and segment-safe', () => {
    assert.equal(locationMentionMatches('art studio in bailesti', 'Băilești'), true);
    assert.equal(locationMentionMatches('in Băilești, Dolj', 'bailesti'), true);
    assert.equal(locationMentionMatches('art studio in craiova', 'Bucharest'), false);
    assert.equal(locationMentionMatches('laboratory in roma', 'Craiova, Romania'), false);
    assert.equal(locationMentionMatches('laboratory in roma', 'Roma, Italy'), true);
    assert.equal(locationMentionMatches('anywhere in romania', 'Craiova, Romania'), true);
  });
});
