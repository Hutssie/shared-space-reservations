export const DEFAULT_CITY_NAME = process.env.DEFAULT_CITY_NAME || 'Craiova';
export const DEFAULT_CITY_LAT = parseFloat(process.env.DEFAULT_CITY_LAT || '44.3191');
export const DEFAULT_CITY_LNG = parseFloat(process.env.DEFAULT_CITY_LNG || '23.7936');
export const NEARBY_RADIUS_KM = parseFloat(process.env.NEARBY_RADIUS_KM || '100');
/** Fallback when geocoder bbox is unavailable for city search. */
export const CITY_FILTER_RADIUS_KM = parseFloat(process.env.CITY_FILTER_RADIUS_KM || '25');
export const CITY_BBOX_BUFFER_PCT = parseFloat(process.env.CITY_BBOX_BUFFER_PCT || '0.10');
export const HOME_RECOMMENDATION_LIMIT = parseInt(process.env.HOME_RECOMMENDATION_LIMIT || '15', 10);

export const HYBRID_WEIGHTS = {
  pop30d: 0.25,
  content: 0.30,
  collab: 0.25,
  location: 0.20,
};

export const COLD_START_WEIGHTS = {
  pop30d: 0.55,
  location: 0.45,
};

export function defaultRankingCenter() {
  return { lat: DEFAULT_CITY_LAT, lng: DEFAULT_CITY_LNG };
}

export const RAG_RETRIEVAL_LIMIT = parseInt(process.env.RAG_RETRIEVAL_LIMIT || '10', 10);
export const RAG_CANDIDATE_POOL = parseInt(process.env.RAG_CANDIDATE_POOL || '80', 10);
export const RAG_RELEVANCE_WEIGHT = parseFloat(process.env.RAG_RELEVANCE_WEIGHT || '0.45');
export const RAG_HYBRID_WEIGHT = parseFloat(process.env.RAG_HYBRID_WEIGHT || '0.35');
export const RAG_POP_WEIGHT = parseFloat(process.env.RAG_POP_WEIGHT || '0.20');
export const RAG_PERSONALIZED_RELEVANCE_WEIGHT = parseFloat(
  process.env.RAG_PERSONALIZED_RELEVANCE_WEIGHT || '0.35'
);
export const RAG_PERSONALIZED_HYBRID_WEIGHT = parseFloat(
  process.env.RAG_PERSONALIZED_HYBRID_WEIGHT || '0.45'
);
export const RAG_FALLBACK_LIMIT = parseInt(process.env.RAG_FALLBACK_LIMIT || '3', 10);
export const AI_SEARCH_POOL_SIZE = parseInt(process.env.AI_SEARCH_POOL_SIZE || '30', 10);
export const AI_SEARCH_DISPLAY_LIMIT = parseInt(process.env.AI_SEARCH_DISPLAY_LIMIT || '6', 10);

// Phase C: semantic retrieval blend. Fraction of the RAG score allocated to
// pgvector cosine similarity when a query embedding + embedded candidates exist.
// The remaining (1 - weight) is split across relevance/hybrid/pop as before.
export const RAG_SEMANTIC_WEIGHT = parseFloat(process.env.RAG_SEMANTIC_WEIGHT || '0.30');

// Embedding model config lives in embeddings.js; re-exported here so all
// recommendation/config knobs are discoverable from one module.
export { EMBEDDING_MODEL, EMBEDDING_DIMS } from './embeddings.js';
