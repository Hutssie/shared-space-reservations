import { amenitiesForResponse, spaceListInclude } from './amenities.js';
import {
  loadPop30dRawCounts,
  minMaxNormalize,
  scoreSpaces,
  stableSortByScore,
} from './recommendations.js';
import {
  DEFAULT_CITY_NAME,
  NEARBY_RADIUS_KM,
  RAG_CANDIDATE_POOL,
  RAG_HYBRID_WEIGHT,
  RAG_PERSONALIZED_HYBRID_WEIGHT,
  RAG_PERSONALIZED_RELEVANCE_WEIGHT,
  RAG_POP_WEIGHT,
  RAG_RELEVANCE_WEIGHT,
  RAG_RETRIEVAL_LIMIT,
  defaultRankingCenter,
} from './recommendationConfig.js';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old',
  'see', 'two', 'way', 'who', 'did', 'let', 'put', 'say', 'she', 'too', 'use', 'that', 'with',
  'have', 'this', 'will', 'your', 'from', 'they', 'been', 'than', 'what', 'when', 'where',
  'which', 'while', 'about', 'into', 'need', 'looking', 'want', 'like', 'some', 'any', 'would',
]);

const RAG_SELECT = {
  id: true,
  title: true,
  category: true,
  location: true,
  pricePerHour: true,
  capacity: true,
  squareMeters: true,
  description: true,
  latitude: true,
  longitude: true,
  amenities: { select: { amenityId: true }, orderBy: { amenityId: 'asc' } },
};

export function tokenizeQuery(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export function buildRetrievalQuery(messages) {
  if (!Array.isArray(messages)) return '';
  const userTurns = messages
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => String(m.content || ''));
  return userTurns.join(' ');
}

export function scoreRelevance(candidates, query) {
  const tokens = tokenizeQuery(query);
  const scores = new Map();

  for (const space of candidates) {
    let score = 0;
    const title = (space.title || '').toLowerCase();
    const category = (space.category || '').toLowerCase();
    const location = (space.location || '').toLowerCase();
    const description = (space.description || '').toLowerCase();

    for (const token of tokens) {
      if (title.includes(token)) score += 3;
      if (category.includes(token)) score += 2;
      if (location.includes(token)) score += 2;
      if (description.includes(token)) score += 1;
    }
    scores.set(space.id, score);
  }
  return scores;
}

export async function fetchKeywordCandidates(prisma, query, { limit = RAG_CANDIDATE_POOL } = {}) {
  const tokens = [...new Set(tokenizeQuery(query))];

  if (tokens.length === 0) {
    return prisma.space.findMany({
      where: { status: 'active' },
      select: RAG_SELECT,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  const orClauses = [];
  for (const token of tokens) {
    orClauses.push(
      { title: { contains: token, mode: 'insensitive' } },
      { description: { contains: token, mode: 'insensitive' } },
      { location: { contains: token, mode: 'insensitive' } },
      { category: { contains: token, mode: 'insensitive' } }
    );
  }

  return prisma.space.findMany({
    where: { status: 'active', OR: orClauses },
    select: RAG_SELECT,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

function truncateDescription(text, maxLen = 180) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 3)}...`;
}

export function formatRagContext(spaces) {
  if (!spaces?.length) {
    return 'RETRIEVED LISTINGS: (none matched the conversation yet — ask clarifying questions; do not invent space names or details.)';
  }

  const lines = [
    'RETRIEVED LISTINGS (authoritative — you may mention only these spaces by name; do not invent listings outside this list):',
  ];

  spaces.forEach((space, i) => {
    const price = space.pricePerHour != null ? Number(space.pricePerHour) : null;
    const priceStr = price != null ? `$${price}/hr` : 'price n/a';
    const amenityIds = amenitiesForResponse(space).join(', ') || 'none';
    const pop30d = space._pop30d != null ? Number(space._pop30d) : null;
    const popStr = pop30d != null && pop30d > 0 ? ` | ${pop30d} bookings (30d)` : '';
    const rankLabel = i === 0 ? ' — top match' : '';
    lines.push(
      `${i + 1}. [id: ${space.id}] ${space.title} | ${space.category} | ${space.location} | ${priceStr} | cap ${space.capacity}${popStr} | amenities: ${amenityIds}${rankLabel}`
    );
    lines.push(`   ${truncateDescription(space.description)}`);
  });

  return lines.join('\n');
}

/** Sort API space cards to match RAG retrieval rank (best match first). */
export function orderSpacesByRetrieval(spaces, retrieved, limit = 6) {
  if (!spaces?.length) return [];
  if (!retrieved?.length) return spaces.slice(0, limit);

  const rank = new Map(retrieved.map((s, i) => [s.id, i]));
  return [...spaces]
    .sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(a.id).localeCompare(String(b.id));
    })
    .slice(0, limit);
}

function ragBlendWeights(userId) {
  if (userId) {
    const relevance = RAG_PERSONALIZED_RELEVANCE_WEIGHT;
    const hybrid = RAG_PERSONALIZED_HYBRID_WEIGHT;
    const pop = Math.max(0, 1 - relevance - hybrid);
    return { relevance, hybrid, pop: pop || RAG_POP_WEIGHT };
  }
  return {
    relevance: RAG_RELEVANCE_WEIGHT,
    hybrid: RAG_HYBRID_WEIGHT,
    pop: RAG_POP_WEIGHT,
  };
}

/**
 * Retrieve top spaces for RAG context: keyword relevance blended with hybrid recommender scores.
 */
export async function retrieveSpacesForRag(
  prisma,
  { messages, userId = null, limit = RAG_RETRIEVAL_LIMIT } = {}
) {
  const query = buildRetrievalQuery(messages);
  const candidates = await fetchKeywordCandidates(prisma, query);
  if (candidates.length === 0) return [];

  const spaceIds = candidates.map((s) => s.id);
  const relevanceRaw = scoreRelevance(candidates, query);
  const relevanceNorm = minMaxNormalize(relevanceRaw);

  const center = defaultRankingCenter();
  const [hybridRaw, popRaw] = await Promise.all([
    scoreSpaces(prisma, {
      spaceIds,
      spaceRows: candidates,
      userId: userId ?? null,
      rankingCenter: center,
      maxRadiusKm: NEARBY_RADIUS_KM,
      cityName: DEFAULT_CITY_NAME,
      forceColdStart: !userId,
    }),
    loadPop30dRawCounts(prisma, spaceIds),
  ]);
  const hybridNorm = minMaxNormalize(hybridRaw);
  const popNorm = minMaxNormalize(popRaw);
  const weights = ragBlendWeights(userId);

  const blended = new Map();
  for (const id of spaceIds) {
    const rel = relevanceNorm.get(id) ?? 0;
    const hyb = hybridNorm.get(id) ?? 0;
    const pop = popNorm.get(id) ?? 0;
    const rawPop = popRaw.get(id) ?? 0;
    blended.set(
      id,
      weights.relevance * rel +
        weights.hybrid * hyb +
        weights.pop * pop +
        rawPop * 1e-6
    );
  }

  const sortedIds = stableSortByScore(spaceIds, blended).slice(0, limit);
  const byId = new Map(candidates.map((s) => [s.id, s]));
  return sortedIds
    .map((id) => {
      const row = byId.get(id);
      if (!row) return null;
      return { ...row, _pop30d: popRaw.get(id) ?? 0 };
    })
    .filter(Boolean);
}

/** Hydrate retrieval rows for API cards (reviews, host, etc.). */
export async function hydrateRetrievedSpaces(prisma, retrievedRows, take = 3) {
  const ids = retrievedRows.slice(0, take).map((s) => s.id);
  if (ids.length === 0) return [];
  const hydrated = await prisma.space.findMany({
    where: { id: { in: ids } },
    include: spaceListInclude,
  });
  const byId = new Map(hydrated.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
