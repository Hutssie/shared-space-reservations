import { Router } from 'express';
import { FunctionCallingMode, GoogleGenerativeAI } from '@google/generative-ai';
import {
  formatRagContext,
  orderSpacesByRetrieval,
  retrieveSpacesForRag,
} from '../lib/aiSearchRetrieval.js';
import {
  AI_SPACE_CATEGORIES,
  buildClarifyMessage,
  buildCloseMatchSteps,
  buildFallbackSearchParams,
  buildSearchParamsForLadder,
  rankSpacesByAmenityOverlap,
  buildFollowUpHint,
  buildResultMessage,
  cardsSatisfyKnownFilters,
  classifySearchResult,
  computeMissingRefinements,
  extractKnownFilters,
  hasEnoughForCards,
  missingForCards,
  shouldSuggestFollowUp,
} from '../lib/aiSearchPolicy.js';
import { parseSearchToolCall, SEARCH_SPACES_TOOLS } from '../lib/aiSearchTools.js';
import { normalizeAmenityIds, spaceListInclude } from '../lib/amenities.js';
import {
  AI_SEARCH_DISPLAY_LIMIT,
  AI_SEARCH_POOL_SIZE,
} from '../lib/recommendationConfig.js';
import {
  parseDateFilterQuery,
  searchSpacesWithDateAvailability,
} from '../lib/spaceAvailabilitySearch.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { buildSpaceSearchWhere, spaceToResponse } from './spaces.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const SYSTEM_PROMPT = `You are SpaceBook's AI Space Assistant — a friendly, knowledgeable booking advisor who helps users find the perfect creative or professional space to rent.

Your personality:
- Warm, conversational, and genuinely helpful
- You give advice, not just answers — explain WHY a type of space might suit them
- Ask clarifying questions naturally when you need more info, but never follow a rigid script
- If the user gives you enough info in one message, skip straight to recommending

Available space categories on SpaceBook:
${AI_SPACE_CATEGORIES.join(', ')}

What you know about these categories:
- Art Studio: painting, sculpting, fine arts, creative workshops
- Photo Studio: photography sessions, product shoots, portraits, lighting setups
- Recording Studio: podcasts, music recording, voiceovers, audio production
- Kitchen Studio: cooking classes, food photography, recipe filming, catering prep
- Dancing Studio: dance classes, rehearsals, choreography, fitness sessions
- Classroom: workshops, tutoring, training sessions, seminars
- Conference Room: business meetings, presentations, team offsites
- IT Classroom: coding bootcamps, tech workshops, computer-based training
- Laboratory: scientific experiments, research, chemistry/biology work
- Sports Space: sports practice, fitness training, yoga, martial arts

Conversation policy (cards display):
- "Enough for cards" means the user provided BOTH: (1) some form of location (city, region, or country) AND (2) enough information to select a space category (explicit category or clear project intent you can map to a category).
- If the user says "anywhere" without a place (e.g. just "anywhere"), do NOT set location and ask for a city, region, or country first.
- If the user says "anywhere in <place>" (e.g. "anywhere in Dolj", "anywhere in Romania"), set location to that place — that counts as a valid location.
- If the user has NOT named a place at all, do NOT copy a location from RETRIEVED LISTINGS.
- If NOT enough for cards: ask ONLY for what is missing (location, category, or both). Do NOT call the search_spaces tool. Do NOT ask for amenities, dates, budget, capacity, or a specific city yet.
- If enough for cards: call the search_spaces tool immediately with location and category. Do NOT ask for optional refinements (specific city, amenities, dates, price, capacity) before searching. Country or region alone is a valid location (e.g. "Romania" is fine — do not ask for a specific city first).
- Keep conversational intro short (1-2 sentences). The system will set the final results message.

search_spaces tool guidelines:
- Call search_spaces only when the user has provided both location and category signals.
- Only include optional fields you can confidently infer from the conversation. Omit fields you are unsure about.
- When the user specifies a capacity (e.g. "fit 2000 people", "more than 100"), include minCapacity.
- The category field MUST be one of the exact category names listed above.
- The location field can be a city, neighborhood, region/county/state, or country — use whatever geographic scope the user provided.
- The q field is a freeform text search across titles and descriptions — use it for specific keywords that don't fit neatly into category/location.
- NEVER replace a country/region with a capital city or any specific city on your own. Use exactly what the user gave you.

Size filtering:
- "minSquareMeters" / "maxSquareMeters" (numbers) — use when the user mentions space size.

Amenity filtering:
- "amenities" is an array of amenity IDs. ONLY use IDs from this list:
  wifi (High-speed WiFi), light (Natural Light), coffee (Free Coffee), parking (On-site Parking), ac (Air Conditioning), access (24/7 Access), sound (Soundproofed), cyc (Cyclorama Wall), green (Green Screen), audio (Pro Sound System), mics (Recording Gear), kitchen (Full Kitchen), chef (Chef-grade Oven), projector (Digital Projector), conferencing (Video Conferencing), monitors (Dual Monitors), easels (Art Easels), mirrors (Full-length Mirrors), gym (Gym Equipment), showers (Locker Rooms), lab (Lab Equipment)

Date filtering:
- "date" is YYYY-MM-DD. Use when the user mentions a date. Today's date is in the conversation context.
- "startTime" and "endTime" are hourly slots in "HH:MM AM/PM" format. Both require "date" to be set.

Formatting (Markdown bold in conversational text):
- Wrap categories, amenities, dates, times, prices, square meters, capacities, and locations in **bold** when mentioned in your reply.

Retrieved listings (RAG):
- Before each reply you receive a RETRIEVED LISTINGS block from our database. You may mention space names, categories, locations, prices, and capacities ONLY from that list.
- Listings are ranked: #1 is the best match. Mention higher-ranked listings first.
- Do not invent listings, prices, or details that are not in RETRIEVED LISTINGS.
- When inferring search parameters, prefer categories and locations that appear in RETRIEVED LISTINGS — but never invent a location the user did not provide.
- If RETRIEVED LISTINGS is empty, ask clarifying questions; do not fabricate space names.

General:
- If the user wants to refine criteria after seeing results, call search_spaces again with updated filters.
- Keep responses concise — 2-4 sentences max when clarifying.`;

const QUOTA_EXCEEDED_MESSAGE =
  "We've reached our daily limit for AI recommendations. You can try again tomorrow, or use the search filters above to find spaces by location, date, and type.";

function is429Error(e) {
  const msg = e?.message ?? String(e);
  return (
    msg.includes('429') ||
    msg.includes('Too Many Requests') ||
    msg.includes('quota') ||
    msg.includes('Quota exceeded')
  );
}

function parseRetryDelayMs(e) {
  const msg = e?.message ?? String(e);
  const match = msg.match(/[Rr]etry in (\d+(?:\.\d+)?)\s*s/);
  if (!match) return null;
  const seconds = parseFloat(match[1], 10);
  if (Number.isNaN(seconds) || seconds <= 0) return null;
  const ms = Math.min(Math.ceil(seconds * 1000), 30000);
  return ms;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finalizeSpaceCards(pool, retrieved, { preserveOrder = false } = {}) {
  const cards = pool.map(spaceToResponse);
  if (preserveOrder) return cards.slice(0, AI_SEARCH_DISPLAY_LIMIT);
  return orderSpacesByRetrieval(cards, retrieved, AI_SEARCH_DISPLAY_LIMIT);
}

async function fetchSearchPool(prisma, stepParams) {
  const amenityIds = normalizeAmenityIds(stepParams.amenities ?? []);

  const where = buildSpaceSearchWhere(
    {
      q: stepParams.q,
      location: stepParams.location,
      category: stepParams.category,
      minPrice: stepParams.minPrice,
      maxPrice: stepParams.maxPrice,
      minCapacity: stepParams.minCapacity,
      minSquareMeters: stepParams.minSquareMeters,
      maxSquareMeters: stepParams.maxSquareMeters,
    },
    amenityIds
  );

  const { dateStart, dateEnd, dateCtx } = parseDateFilterQuery(
    stepParams.date ? String(stepParams.date) : null
  );

  let pool;
  if (dateStart && dateEnd && dateCtx) {
    const timeRange =
      stepParams.startTime && stepParams.endTime
        ? {
            startTime: String(stepParams.startTime),
            endTime: String(stepParams.endTime),
          }
        : null;
    const dateResult = await searchSpacesWithDateAvailability(prisma, {
      where,
      dateStart,
      dateEnd,
      dateCtx,
      skip: 0,
      take: AI_SEARCH_POOL_SIZE,
      timeRange,
      targetAvailable: AI_SEARCH_POOL_SIZE,
      maxScan: 400,
    });
    pool = dateResult.spaces;
  } else {
    pool = await prisma.space.findMany({
      where,
      include: spaceListInclude,
      take: AI_SEARCH_POOL_SIZE,
      orderBy: { createdAt: 'desc' },
    });
  }

  return pool;
}

async function runSearchStep(prisma, stepParams, retrieved) {
  const pool = await fetchSearchPool(prisma, stepParams);
  return finalizeSpaceCards(pool, retrieved);
}

async function runAmenityOverlapCloseMatch(prisma, strictStep, retrieved) {
  const requested = normalizeAmenityIds(strictStep.amenities ?? []);
  if (requested.length <= 1) return [];

  const pool = await fetchSearchPool(prisma, { ...strictStep, amenities: [] });
  const ranked = rankSpacesByAmenityOverlap(pool, requested, retrieved);
  return finalizeSpaceCards(ranked, retrieved, { preserveOrder: true });
}

async function executeSearchLadder(prisma, searchParams, retrieved, knownFilters) {
  const steps = buildCloseMatchSteps(searchParams);
  if (steps.length === 0) {
    return { spaces: [], resultType: 'none', fallbackSource: null, strictCount: 0 };
  }

  let strictSpaces = await runSearchStep(prisma, steps[0], retrieved);
  if (strictSpaces.length > 0 && !cardsSatisfyKnownFilters(strictSpaces, knownFilters)) {
    strictSpaces = [];
  }
  if (strictSpaces.length > 0) {
    return {
      spaces: strictSpaces,
      resultType: classifySearchResult(strictSpaces.length, null),
      fallbackSource: null,
      strictCount: strictSpaces.length,
    };
  }

  const overlapSpaces = await runAmenityOverlapCloseMatch(prisma, steps[0], retrieved);
  if (overlapSpaces.length > 0) {
    return {
      spaces: overlapSpaces,
      resultType: classifySearchResult(0, 'relaxed'),
      fallbackSource: 'relaxed',
      strictCount: 0,
    };
  }

  for (let i = 1; i < steps.length; i++) {
    const relaxedSpaces = await runSearchStep(prisma, steps[i], retrieved);
    if (relaxedSpaces.length > 0) {
      return {
        spaces: relaxedSpaces,
        resultType: classifySearchResult(0, 'relaxed'),
        fallbackSource: 'relaxed',
        strictCount: 0,
      };
    }
  }

  return {
    spaces: [],
    resultType: 'none',
    fallbackSource: null,
    strictCount: 0,
  };
}

router.post('/chat', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const retrieved = await retrieveSpacesForRag(prisma, {
      messages,
      userId: req.userId ?? null,
    });
    const ragBlock = formatRagContext(retrieved);

    const today = new Date().toISOString().slice(0, 10);
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    const systemWithDate = `${SYSTEM_PROMPT}\n\nCurrent date context: Today is ${dayOfWeek}, ${today}. Use this to resolve relative date references like "tomorrow", "next Monday", etc.\n\n${ragBlock}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemWithDate,
      tools: SEARCH_SPACES_TOOLS,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
    });

    const rawHistory = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));
    const history = rawHistory.slice(
      rawHistory.findIndex((m) => m.role === 'user')
    );
    if (history.length > 0 && history[0].role !== 'user') {
      history.length = 0;
    }

    const lastMessage = messages[messages.length - 1];
    const lastContent = lastMessage?.content;
    if (lastContent == null || String(lastContent).trim() === '') {
      return res.status(400).json({ error: 'Last message must have content' });
    }

    const chat = model.startChat({ history });
    const lastContentStr = String(lastContent).trim();

    let result;
    try {
      result = await chat.sendMessage(lastContentStr);
    } catch (e) {
      if (!is429Error(e)) {
        return next(e);
      }
      const delayMs = parseRetryDelayMs(e) ?? 17000;
      await sleep(delayMs);
      try {
        result = await chat.sendMessage(lastContentStr);
      } catch (e2) {
        return res.status(200).json({ message: QUOTA_EXCEEDED_MESSAGE });
      }
    }

    const response = result?.response;
    if (!response) {
      return res.status(502).json({ error: 'Gemini returned no reply. The response may have been blocked or empty.' });
    }
    const { searchParams: toolParams, toolUsed } = parseSearchToolCall(response);

    const referenceDate = new Date(`${today}T12:00:00`);
    const knownFilters = extractKnownFilters(messages, toolParams, { referenceDate });
    const enoughForCards = hasEnoughForCards(knownFilters);

    if (!enoughForCards) {
      const missing = missingForCards(knownFilters);
      return res.json({
        message: buildClarifyMessage(missing),
        searchMeta: {
          resultType: 'clarify',
          knownFilters,
          missingForCards: missing,
          suggestFollowUp: false,
          toolUsed,
        },
      });
    }

    const geminiParams =
      toolParams && typeof toolParams === 'object'
        ? toolParams
        : buildFallbackSearchParams(knownFilters);
    const searchParams = buildSearchParamsForLadder(knownFilters, geminiParams);

    let spaces;
    let resultType = 'none';
    let followUp;
    let message;

    if (searchParams) {
      const searchResult = await executeSearchLadder(prisma, searchParams, retrieved, knownFilters);
      spaces = searchResult.spaces;
      resultType = searchResult.resultType;
      message = buildResultMessage(resultType, spaces.length);

      if (spaces.length > 0 && shouldSuggestFollowUp(knownFilters)) {
        const missingRefinements = computeMissingRefinements(knownFilters);
        followUp = buildFollowUpHint(missingRefinements);
      }
    }

    const bookingPrefill = searchParams
      ? {
          date: searchParams.date || null,
          startTime: searchParams.startTime || null,
          endTime: searchParams.endTime || null,
        }
      : undefined;

    const missingRefinements = computeMissingRefinements(knownFilters);

    res.json({
      message,
      ...(spaces && spaces.length > 0 ? { spaces } : {}),
      ...(followUp ? { followUp } : {}),
      searchMeta: {
        resultType,
        knownFilters,
        suggestFollowUp: Boolean(followUp),
        missingRefinements,
        toolUsed,
      },
      ...(bookingPrefill ? { bookingPrefill } : {}),
    });
  } catch (e) {
    next(e);
  }
});

export { router as aiSearchRouter };
