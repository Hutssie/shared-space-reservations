/** Canonical amenity ids (aligned with frontend FilterDropdowns / AI search). */
export const AMENITY_ID_TO_LABELS = {
  wifi: ['High-speed WiFi'],
  light: ['Natural Light'],
  coffee: ['Free Coffee'],
  parking: ['On-site Parking'],
  ac: ['Air Conditioning', 'AC & Heating'],
  access: ['24/7 Access'],
  sound: ['Soundproofed', 'Sound Isolation'],
  cyc: ['Cyclorama Wall'],
  green: ['Green Screen'],
  audio: ['Pro Sound System', 'Professional Sound System'],
  mics: ['Recording Gear', 'Pro Tools HD'],
  kitchen: ['Full Kitchen'],
  chef: ['Chef-grade Oven', 'Commercial Range', 'Double Ovens'],
  projector: ['Digital Projector'],
  conferencing: ['Video Conferencing'],
  monitors: ['Dual Monitors', 'Board Table'],
  easels: ['Art Easels', 'Track Lighting', 'White Walls'],
  mirrors: ['Full-length Mirrors', 'Full Mirrors'],
  gym: ['Gym Equipment'],
  showers: ['Locker Rooms'],
  lab: ['Lab Equipment'],
};

const LABEL_TO_ID = new Map();
for (const [id, labels] of Object.entries(AMENITY_ID_TO_LABELS)) {
  for (const label of labels) {
    LABEL_TO_ID.set(label.toLowerCase(), id);
  }
  LABEL_TO_ID.set(id.toLowerCase(), id);
}

export function isKnownAmenityId(id) {
  return typeof id === 'string' && id in AMENITY_ID_TO_LABELS;
}

/** Resolve stored JSON entry (id or legacy label) to canonical amenity id. */
export function resolveEntryToAmenityId(entry) {
  if (entry == null) return null;
  const s = String(entry).trim();
  if (!s) return null;
  if (isKnownAmenityId(s)) return s;
  return LABEL_TO_ID.get(s.toLowerCase()) ?? null;
}

export function normalizeAmenityIds(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const ids = new Set();
  for (const entry of list) {
    const id = resolveEntryToAmenityId(entry);
    if (id) ids.add(id);
  }
  return [...ids];
}

export function amenitiesJsonFromIds(ids) {
  return JSON.stringify(normalizeAmenityIds(ids));
}

/** Prisma where: space must have every listed amenity (SQL via relation AND). */
export function amenityFilterClause(amenityIds) {
  const valid = normalizeAmenityIds(amenityIds);
  if (valid.length === 0) return {};
  return {
    AND: valid.map((amenityId) => ({
      amenities: { some: { amenityId } },
    })),
  };
}

export function amenitiesForResponse(space) {
  if (space.amenities?.length) {
    return space.amenities.map((a) => a.amenityId);
  }
  return [];
}

import { spaceAvailabilityInclude } from './spaceAvailabilityRules.js';

export const spaceListInclude = {
  host: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
  reviews: { select: { rating: true } },
  amenities: { select: { amenityId: true }, orderBy: { amenityId: 'asc' } },
  ...spaceAvailabilityInclude,
};

export async function seedAmenityCatalog(prisma) {
  for (const [id, labels] of Object.entries(AMENITY_ID_TO_LABELS)) {
    await prisma.amenity.upsert({
      where: { id },
      create: { id, label: labels[0] },
      update: { label: labels[0] },
    });
  }
}

export async function syncSpaceAmenities(prisma, spaceId, rawAmenities) {
  const amenityIds = normalizeAmenityIds(rawAmenities);
  await prisma.spaceAmenity.deleteMany({ where: { spaceId } });
  if (amenityIds.length === 0) return amenityIds;
  await prisma.spaceAmenity.createMany({
    data: amenityIds.map((amenityId) => ({ spaceId, amenityId })),
    skipDuplicates: true,
  });
  return amenityIds;
}
