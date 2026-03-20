import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSpaceWhereClause, spaceToResponse, AMENITY_ID_TO_LABELS, computeIsSpaceAvailableOnDate, computeIsSpaceAvailableInRange } from './spaces.js';

const router = Router();
const prisma = new PrismaClient();

const SYSTEM_PROMPT = `You are SpaceBook's AI Space Assistant — a friendly, knowledgeable booking advisor who helps users find the perfect creative or professional space to rent.

Your personality:
- Warm, conversational, and genuinely helpful
- You give advice, not just answers — explain WHY a type of space might suit them
- Ask clarifying questions naturally when you need more info, but never follow a rigid script
- If the user gives you enough info in one message, skip straight to recommending

Available space categories on SpaceBook:
Art Studio, Photo Studio, Recording Studio, Kitchen Studio, Dancing Studio, Classroom, Conference Room, IT Classroom, Laboratory, Sports Space

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

Guidelines:
- When you have gathered enough context to recommend spaces, include EXACTLY ONE search block in your response using this format:
  <<<SEARCH{"location":"...","category":"...","q":"...","minPrice":...,"maxPrice":...,"minCapacity":...,"minSquareMeters":...,"maxSquareMeters":...,"amenities":["..."],"date":"YYYY-MM-DD","startTime":"HH:MM AM","endTime":"HH:MM PM"}>>>
- Only include fields you can confidently infer from the conversation. Omit fields you are unsure about.
- When the user specifies a capacity (e.g. "fit 2000 people", "more than 100"), you MUST include "minCapacity" in the search block. Never suggest spaces without including every criterion the user gave; if the search returns no results, the system will tell the user.
- The "category" field MUST be one of the exact category names listed above.
- The "location" field can be a city, neighborhood, region/county/state, or country — use whatever geographic scope the user provided.
- The "q" field is a freeform text search across titles and descriptions — use it for specific keywords the user mentioned that don't fit neatly into category/location.

Location scope (city ask-once rule):
- If the user explicitly says "anywhere in <country/region>", "any city inside <country/region>", or similar broad phrasing, set "location" to that country/region string immediately and proceed with the search. Do NOT ask for a specific city.
- If the user mentions only a country or region without "anywhere/any city" (e.g. "in Romania"), you may ask ONCE whether they want a specific city or anywhere in that country/region. Example: "Do you have a specific city in mind, or should I look anywhere in **Romania**?"
- After you have already asked once for a city, NEVER ask again. If the user still hasn't provided a specific city, proceed with the broader country/region as the "location" value.
- NEVER replace a country/region with a capital city or any specific city on your own. Use exactly what the user gave you.

Size filtering:
- "minSquareMeters" / "maxSquareMeters" (numbers) — use when the user mentions space size (e.g. "at least 50 m²", "not bigger than 100 square meters").

Amenity filtering:
- "amenities" is an array of amenity IDs. ONLY use IDs from this list:
  wifi (High-speed WiFi), light (Natural Light), coffee (Free Coffee), parking (On-site Parking), ac (Air Conditioning), access (24/7 Access), sound (Soundproofed), cyc (Cyclorama Wall), green (Green Screen), audio (Pro Sound System), mics (Recording Gear), kitchen (Full Kitchen), chef (Chef-grade Oven), projector (Digital Projector), conferencing (Video Conferencing), monitors (Dual Monitors / Board Table), easels (Art Easels / Track Lighting), mirrors (Full-length Mirrors), gym (Gym Equipment), showers (Locker Rooms), lab (Lab Equipment)
- Map user phrases to the correct ID. Examples: "WiFi" -> "wifi", "natural light" -> "light", "parking" -> "parking", "soundproof" -> "sound", "green screen" -> "green".

Date filtering:
- "date" is a specific date in YYYY-MM-DD format. Use it when the user mentions a date.
- Today's date will be provided to you in the conversation context. Convert relative phrases like "tomorrow", "next Monday", "this Saturday" into an actual YYYY-MM-DD date. If you cannot determine the exact date, omit the field and ask.

Time range filtering:
- "startTime" and "endTime" are hour slots in "HH:MM AM/PM" format (e.g. "12:00 PM", "04:00 PM").
- Valid slots: 12:00 AM, 01:00 AM, 02:00 AM, ..., 11:00 PM (24 hourly slots).
- Use these when the user specifies a time window (e.g. "between 2 PM and 6 PM", "in the morning", "afternoon").
- Both fields should be provided together. If the user only mentions one, ask for the other.
- Common mappings: "morning" -> startTime "08:00 AM", endTime "12:00 PM"; "afternoon" -> startTime "12:00 PM", endTime "05:00 PM"; "evening" -> startTime "05:00 PM", endTime "10:00 PM".
- These fields require "date" to also be set. If the user gives a time range but no date, ask for the date.

Formatting (use Markdown bold in conversational text):
- When you mention any of the following in your conversational text (outside the <<<SEARCH...>>> block), wrap the exact value in **bold**:
  - space categories
  - amenities
  - dates
  - hours / time ranges (start/end)
  - prices
  - square meters
  - capacities
  - locations
- Examples: **Bucharest**, **Kitchen Studio**, **Natural Light**, **2026-03-24**, **12:00 PM**, **4:00 PM**, **$50/hr**, **120 m²**, **2,000 people**.

General:
- Place the search block at the very end of your message, after your conversational text.
- NEVER invent or fabricate space names, prices, or details. The system will attach real results from the database after your search block.
- After producing a search block, write your conversational text as if results will follow — e.g. "Here are some spaces that would be perfect for you:" or "I found a few options that match what you're looking for:"
- If no results come back, the system will let you know. You can then suggest broadening the search.
- Keep responses concise — 2-4 sentences max before showing results.
- If the user wants to refine or try different criteria after seeing results, happily adjust.`;

const SEARCH_BLOCK_RE = /<<<SEARCH(\{[\s\S]*?\})>>>/;

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

function parseSearchBlock(text) {
  const match = text.match(SEARCH_BLOCK_RE);
  if (!match) return { message: text.trim(), searchParams: null };
  try {
    const params = JSON.parse(match[1]);
    const message = text.replace(SEARCH_BLOCK_RE, '').trim();
    return { message, searchParams: params };
  } catch {
    return { message: text.replace(SEARCH_BLOCK_RE, '').trim(), searchParams: null };
  }
}

router.post('/chat', async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    const systemWithDate = `${SYSTEM_PROMPT}\n\nCurrent date context: Today is ${dayOfWeek}, ${today}. Use this to resolve relative date references like "tomorrow", "next Monday", etc.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemWithDate,
    });

    const rawHistory = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));
    // Gemini requires the first message in history to be from the user, not the model.
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
    let responseText;
    try {
      responseText = response.text();
    } catch (e) {
      const msg = e?.message || String(e);
      return res.status(502).json({ error: `Could not read model reply: ${msg}` });
    }
    if (typeof responseText !== 'string') responseText = '';

    let { message, searchParams } = parseSearchBlock(responseText);

    let spaces = undefined;
    if (searchParams && typeof searchParams === 'object') {
      const where = buildSpaceWhereClause({
        q: searchParams.q,
        location: searchParams.location,
        category: searchParams.category,
        minPrice: searchParams.minPrice,
        maxPrice: searchParams.maxPrice,
        minCapacity: searchParams.minCapacity,
        minSquareMeters: searchParams.minSquareMeters,
        maxSquareMeters: searchParams.maxSquareMeters,
      });

      const amenityIds = Array.isArray(searchParams.amenities)
        ? searchParams.amenities.filter((a) => typeof a === 'string' && a in AMENITY_ID_TO_LABELS)
        : [];

      const dateStr = searchParams.date ? String(searchParams.date) : null;
      let dateStart = null;
      let dateEnd = null;
      let dayName = null;
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          dateStart = new Date(parsed);
          dateStart.setUTCHours(0, 0, 0, 0);
          dateEnd = new Date(parsed);
          dateEnd.setUTCHours(23, 59, 59, 999);
          const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          dayName = DAY_NAMES[parsed.getDay()];
        }
      }

      const needsDateFilter = dateStart && dateEnd;
      const needsAmenityFilter = amenityIds.length > 0;
      const poolSize = (needsDateFilter || needsAmenityFilter) ? 100 : 6;

      let pool = await prisma.space.findMany({
        where,
        include: {
          host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
          reviews: { select: { rating: true } },
        },
        take: poolSize,
        orderBy: { createdAt: 'desc' },
      });

      if (needsAmenityFilter) {
        pool = pool.filter((space) => {
          const spaceAmenities = space.amenitiesJson ? JSON.parse(space.amenitiesJson) : [];
          return amenityIds.every((id) => {
            const labels = AMENITY_ID_TO_LABELS[id];
            return spaceAmenities.some((a) => a === id || (Array.isArray(labels) && labels.includes(a)));
          });
        });
      }

      if (needsDateFilter) {
        const ids = pool.map((s) => s.id);
        const bookings = ids.length > 0
          ? await prisma.booking.findMany({
              where: {
                spaceId: { in: ids },
                date: { gte: dateStart, lte: dateEnd },
                status: { in: ['confirmed', 'pending'] },
              },
              select: { spaceId: true, startTime: true, endTime: true },
            })
          : [];
        const bySpaceId = new Map();
        for (const b of bookings) {
          if (!bySpaceId.has(b.spaceId)) bySpaceId.set(b.spaceId, []);
          bySpaceId.get(b.spaceId).push(b);
        }
        const dateCtx = { dateStr: dateStart.toISOString().slice(0, 10), dayName };
        const hasTimeRange = searchParams.startTime && searchParams.endTime;
        if (hasTimeRange) {
          const rangeCtx = { ...dateCtx, startTime: String(searchParams.startTime), endTime: String(searchParams.endTime) };
          pool = pool.filter((s) => computeIsSpaceAvailableInRange(s, bySpaceId.get(s.id) ?? [], rangeCtx));
        } else {
          pool = pool.filter((s) => computeIsSpaceAvailableOnDate(s, bySpaceId.get(s.id) ?? [], dateCtx));
        }
      }

      spaces = pool.slice(0, 6).map(spaceToResponse);

      if (spaces.length === 0) {
        const broadWhere = buildSpaceWhereClause({
          q: searchParams.q || searchParams.category,
          location: searchParams.location,
          category: searchParams.category,
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          minCapacity: searchParams.minCapacity,
          minSquareMeters: searchParams.minSquareMeters,
          maxSquareMeters: searchParams.maxSquareMeters,
        });
        const broadResults = await prisma.space.findMany({
          where: broadWhere,
          include: {
            host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
            reviews: { select: { rating: true } },
          },
          take: 6,
          orderBy: { createdAt: 'desc' },
        });
        spaces = broadResults.map(spaceToResponse);
      }

      if (spaces.length === 0 && searchParams.location) {
        const tokens = String(searchParams.location)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        if (tokens.length > 0) {
          const tokenWhere = {
            status: 'active',
            OR: tokens.map((tok) => ({ location: { contains: tok, mode: 'insensitive' } })),
          };
          if (searchParams.category) {
            const cats = String(searchParams.category).split(',').map((c) => c.trim()).filter(Boolean);
            tokenWhere.category = cats.length === 1 ? cats[0] : { in: cats };
          }
          if (searchParams.minPrice != null) tokenWhere.pricePerHour = { ...tokenWhere.pricePerHour, gte: parseFloat(searchParams.minPrice) };
          if (searchParams.maxPrice != null) tokenWhere.pricePerHour = { ...tokenWhere.pricePerHour, lte: parseFloat(searchParams.maxPrice) };
          if (searchParams.minCapacity != null) tokenWhere.capacity = { gte: parseInt(searchParams.minCapacity, 10) };
          if (searchParams.minSquareMeters != null) tokenWhere.squareMeters = { ...tokenWhere.squareMeters, gte: parseInt(searchParams.minSquareMeters, 10) };
          if (searchParams.maxSquareMeters != null) tokenWhere.squareMeters = { ...tokenWhere.squareMeters, lte: parseInt(searchParams.maxSquareMeters, 10) };

          const tokenResults = await prisma.space.findMany({
            where: tokenWhere,
            include: {
              host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
              reviews: { select: { rating: true } },
            },
            take: 6,
            orderBy: { createdAt: 'desc' },
          });
          spaces = tokenResults.map(spaceToResponse);
        }
      }

      if (spaces.length === 0) {
        message = "I couldn't find any spaces matching those exact criteria. Try broadening your search \u2014 for example, a different date, location, or removing some filters. I'm happy to help you adjust!";
      }
    }

    const bookingPrefill = searchParams ? {
      date: searchParams.date || null,
      startTime: searchParams.startTime || null,
      endTime: searchParams.endTime || null,
    } : undefined;

    res.json({
      message,
      ...(spaces && spaces.length > 0 ? { spaces } : {}),
      ...(bookingPrefill ? { bookingPrefill } : {}),
    });
  } catch (e) {
    next(e);
  }
});

export { router as aiSearchRouter };
