import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { AMENITY_ID_TO_LABELS } from './amenities.js';

/**
 * Embedding configuration. Defaults are baked in so .env stays optional;
 * EMBEDDING_DIMS must match the Space.embedding vector column (vector(768)).
 */
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
export const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMS || '768', 10);
export const EMBEDDING_BATCH_SIZE = parseInt(process.env.EMBEDDING_BATCH_SIZE || '50', 10);

let cachedModel = null;

/** Lazily build the Gemini embedding model; returns null when no API key is set. */
function getEmbeddingModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedModel) {
    const genAI = new GoogleGenerativeAI(apiKey);
    cachedModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  }
  return cachedModel;
}

/** Resolve a space's amenities to human-readable labels for the embedding text. */
function resolveAmenityLabels(space) {
  if (Array.isArray(space?.amenityLabels)) return space.amenityLabels.filter(Boolean);
  let ids = [];
  if (Array.isArray(space?.amenityIds)) {
    ids = space.amenityIds;
  } else if (Array.isArray(space?.amenities)) {
    ids = space.amenities.map((a) => (typeof a === 'string' ? a : a?.amenityId)).filter(Boolean);
  }
  return ids.map((id) => {
    const labels = AMENITY_ID_TO_LABELS[id];
    return Array.isArray(labels) && labels.length ? labels[0] : String(id);
  });
}

/**
 * Build the canonical text document that represents a space for embedding.
 * Tolerant of sparse input: omits empty sections and never throws.
 */
export function buildSpaceEmbeddingText(space) {
  if (!space || typeof space !== 'object') return '';
  const parts = [];
  if (space.title) parts.push(`Title: ${space.title}`);
  if (space.category) parts.push(`Category: ${space.category}`);
  if (space.location) parts.push(`Location: ${space.location}`);
  const labels = resolveAmenityLabels(space);
  if (labels.length) parts.push(`Amenities: ${labels.join(', ')}`);
  if (space.description) parts.push(`Description: ${space.description}`);
  return parts.join('\n');
}

/** Format a numeric array as a pgvector literal, e.g. [0.1,0.2,0.3]. */
export function toSqlVector(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('toSqlVector requires a non-empty numeric array');
  }
  return `[${values.join(',')}]`;
}

/** Retry helper with exponential backoff on rate-limit (429) errors. */
async function withRetry(fn, { retries = 5, baseDelayMs = 1000 } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      const status = e?.status ?? e?.response?.status;
      const msg = String(e?.message || '');
      const isRateLimited =
        status === 429 || /\b429\b|rate limit|quota|resource[_ ]?exhausted/i.test(msg);
      if (!isRateLimited || attempt >= retries) throw e;
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
    }
  }
}

async function embedWithTaskType(text, taskType) {
  const model = getEmbeddingModel();
  if (!model || !text || !String(text).trim()) return null;
  const res = await withRetry(() =>
    model.embedContent({
      content: { parts: [{ text: String(text) }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMS,
    })
  );
  const values = res?.embedding?.values;
  return Array.isArray(values) ? values : null;
}

/** Embed a stored document (space listing). Returns number[] or null on failure / no key. */
export function embedDocument(text) {
  return embedWithTaskType(text, TaskType.RETRIEVAL_DOCUMENT);
}

/** Embed a search query. Returns number[] or null on failure / no key. */
export function embedQuery(text) {
  return embedWithTaskType(text, TaskType.RETRIEVAL_QUERY);
}

/**
 * Embed many documents in batches with 429 retry. Returns an array aligned to
 * `texts` where each entry is number[] or null (null when the API has no key or
 * an individual embedding came back malformed).
 */
export async function embedDocumentsBatch(texts, { batchSize = EMBEDDING_BATCH_SIZE } = {}) {
  const list = Array.isArray(texts) ? texts : [];
  const model = getEmbeddingModel();
  if (!model) return list.map(() => null);

  const out = [];
  for (let i = 0; i < list.length; i += batchSize) {
    const chunk = list.slice(i, i + batchSize);
    const res = await withRetry(() =>
      model.batchEmbedContents({
        requests: chunk.map((text) => ({
          content: { parts: [{ text: String(text ?? '') }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
          outputDimensionality: EMBEDDING_DIMS,
        })),
      })
    );
    const embs = res?.embeddings ?? [];
    for (let j = 0; j < chunk.length; j += 1) {
      const v = embs[j]?.values;
      out.push(Array.isArray(v) ? v : null);
    }
  }
  return out;
}
