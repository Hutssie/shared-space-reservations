import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  normalizeAmenityIds,
  seedAmenityCatalog,
  syncSpaceAmenities,
} from '../src/lib/amenities.js';
import { resolveBookingMinutes } from '../src/lib/bookingTime.js';
import { locationNormFromDisplay } from '../src/lib/textNormalize.js';

const prisma = new PrismaClient();

const SPACES = [
  {
    category: 'Photo Studio',
    title: 'Bright Industrial Loft Office',
    location: 'Brooklyn, NY',
    capacity: 20,
    pricePerHour: 95,
    description: 'A stunning 2,500 sq ft industrial loft in the heart of Williamsburg. Featuring 14ft ceilings, original brick walls, and massive south-facing windows that flood the space with natural light all day.',
    imageUrl: 'https://images.unsplash.com/photo-1769488702396-8b68825a4a11?q=80&w=800',
    imagesJson: JSON.stringify([
      'https://images.unsplash.com/photo-1716703433576-13ff2922db95?q=80&w=1200',
      'https://images.unsplash.com/photo-1769488702396-8b68825a4a11?q=80&w=800',
      'https://images.unsplash.com/photo-1688670097051-26b24bb30ec1?q=80&w=800',
    ]),
    amenitiesJson: JSON.stringify(['wifi', 'light', 'audio', 'kitchen', 'ac']),
    isInstantBookable: true,
    latitude: 40.6782,
    longitude: -73.9442,
  },
  {
    category: 'Recording Studio',
    title: 'Premium Music Production Suite',
    location: 'Nashville, TN',
    capacity: 6,
    pricePerHour: 150,
    description: 'Professional grade recording studio with high-end outboard gear and isolated vocal booth.',
    imageUrl: 'https://images.unsplash.com/photo-1688670097051-26b24bb30ec1?q=80&w=800',
    imagesJson: JSON.stringify(['https://images.unsplash.com/photo-1688670097051-26b24bb30ec1?q=80&w=1200']),
    amenitiesJson: JSON.stringify(['sound', 'mics']),
    isInstantBookable: false,
    latitude: 36.1627,
    longitude: -86.7816,
  },
  {
    category: 'Art Studio',
    title: 'Minimalist White Wall Gallery',
    location: 'Chelsea, NY',
    capacity: 45,
    pricePerHour: 200,
    description: 'Perfect for art exhibitions and high-end brand launches. Features clean white walls and professional gallery lighting.',
    imageUrl: 'https://images.unsplash.com/photo-1767294274414-5e1e6c3974e9?q=80&w=800',
    imagesJson: JSON.stringify(['https://images.unsplash.com/photo-1767294274414-5e1e6c3974e9?q=80&w=1200']),
    amenitiesJson: JSON.stringify(['easels']),
    isInstantBookable: true,
    latitude: 40.7465,
    longitude: -74.0014,
  },
  {
    category: 'Conference Room',
    title: 'Skyline View Executive Suite',
    location: 'Chicago, IL',
    capacity: 12,
    pricePerHour: 175,
    description: 'Corporate executive suite with sweeping views of the Chicago skyline. Designed for high-level meetings and presentations.',
    imageUrl: 'https://images.unsplash.com/photo-1765366417044-9e84ce8ec942?q=80&w=800',
    imagesJson: JSON.stringify(['https://images.unsplash.com/photo-1765366417044-9e84ce8ec942?q=80&w=1200']),
    amenitiesJson: JSON.stringify(['conferencing', 'monitors']),
    isInstantBookable: false,
    latitude: 41.8781,
    longitude: -87.6298,
  },
  {
    category: 'Kitchen Studio',
    title: "Modern Chef's Kitchen Studio",
    location: 'Austin, TX',
    capacity: 15,
    pricePerHour: 130,
    description: 'Fully functional kitchen studio with professional appliances and natural light. Ideal for food photography and video production.',
    imageUrl: 'https://images.unsplash.com/photo-1708915965975-2a950db0e215?q=80&w=800',
    imagesJson: JSON.stringify(['https://images.unsplash.com/photo-1708915965975-2a950db0e215?q=80&w=1200']),
    amenitiesJson: JSON.stringify(['chef']),
    isInstantBookable: true,
    latitude: 30.2672,
    longitude: -97.7431,
  },
  {
    category: 'Dancing Studio',
    title: 'Urban Rehearsal Dance Studio',
    location: 'Los Angeles, CA',
    capacity: 30,
    pricePerHour: 80,
    description: 'Spacious dance studio with floor-to-ceiling mirrors and sprung wood floors. Perfect for rehearsals and workshops.',
    imageUrl: 'https://images.unsplash.com/photo-1740813402046-08ec3e0ce5d2?q=80&w=800',
    imagesJson: JSON.stringify(['https://images.unsplash.com/photo-1740813402046-08ec3e0ce5d2?q=80&w=1200']),
    amenitiesJson: JSON.stringify(['mirrors']),
    isInstantBookable: false,
    latitude: 34.0522,
    longitude: -118.2437,
  },
];

async function main() {
  const hash = await bcrypt.hash('Password123', 10);
  const verifiedAt = new Date();
  const host = await prisma.user.upsert({
    where: { email: 'host@example.com' },
    update: { emailVerifiedAt: verifiedAt },
    create: {
      email: 'host@example.com',
      passwordHash: hash,
      name: 'Sarah Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200',
      emailVerifiedAt: verifiedAt,
    },
  });

  const guest = await prisma.user.upsert({
    where: { email: 'guest@example.com' },
    update: { emailVerifiedAt: verifiedAt },
    create: {
      email: 'guest@example.com',
      passwordHash: hash,
      name: 'Guest User',
      avatarUrl: null,
      emailVerifiedAt: verifiedAt,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { role: 'admin', passwordHash: hash, emailVerifiedAt: verifiedAt },
    create: {
      email: 'admin@example.com',
      passwordHash: hash,
      name: 'Admin',
      role: 'admin',
      emailVerifiedAt: verifiedAt,
    },
  });

  await seedAmenityCatalog(prisma);

  const existingSpaces = await prisma.space.count();
  if (existingSpaces === 0) {
    for (const s of SPACES) {
      const { amenitiesJson, ...rest } = s;
      const amenityIds = normalizeAmenityIds(amenitiesJson ? JSON.parse(amenitiesJson) : []);
      const created = await prisma.space.create({
        data: {
          hostId: host.id,
          ...rest,
          locationNorm: locationNormFromDisplay(rest.location),
        },
      });
      await syncSpaceAmenities(prisma, created.id, amenityIds);
    }
  } else {
    // Backfill lat/lng for existing spaces that lack coordinates
    const locationCoords = {
      'Brooklyn, NY': { latitude: 40.6782, longitude: -73.9442 },
      'Nashville, TN': { latitude: 36.1627, longitude: -86.7816 },
      'Chelsea, NY': { latitude: 40.7465, longitude: -74.0014 },
      'Chicago, IL': { latitude: 41.8781, longitude: -87.6298 },
      'Austin, TX': { latitude: 30.2672, longitude: -97.7431 },
      'Los Angeles, CA': { latitude: 34.0522, longitude: -118.2437 },
      'Craiova': { latitude: 44.3191, longitude: 23.7936 },
    };
    const withoutCoords = await prisma.space.findMany({
      where: { latitude: null },
    });
    for (const space of withoutCoords) {
      let coords = locationCoords[space.location];
      if (!coords && space.location && space.location.toLowerCase().includes('craiova')) {
        coords = locationCoords['Craiova'];
      }
      if (coords) {
        await prisma.space.update({
          where: { id: space.id },
          data: coords,
        });
      }
    }
  }

  const targetTestListings = 1700;
  const currentCount = await prisma.space.count();
  if (currentCount < targetTestListings) {
    const categories = ['Photo Studio', 'Recording Studio', 'Art Studio', 'Conference Room', 'Kitchen Studio', 'Dancing Studio'];
    const cities = ['Brooklyn, NY', 'Manhattan, NY', 'Chicago, IL', 'Los Angeles, CA', 'Austin, TX', 'Nashville, TN', 'Seattle, WA', 'Miami, FL', 'Denver, CO', 'Portland, OR', 'Craiova, Romania'];
    const toCreate = targetTestListings - currentCount;
    const imageUrl = 'https://images.unsplash.com/photo-1769488702396-8b68825a4a11?q=80&w=800';
    const imagesJson = JSON.stringify([imageUrl]);
    const testAmenityIds = ['wifi', 'ac'];
    for (let i = 0; i < toCreate; i++) {
      const category = categories[i % categories.length];
      const city = cities[i % cities.length];
      const created = await prisma.space.create({
        data: {
          hostId: host.id,
          category,
          title: `Test Listing #${currentCount + i + 1} – ${category}`,
          location: city,
          locationNorm: locationNormFromDisplay(city),
          capacity: 5 + (i % 20),
          pricePerHour: 50 + (i % 150),
          description: `Pagination test space ${currentCount + i + 1}. ${category} in ${city}.`,
          imageUrl,
          imagesJson,
          isInstantBookable: i % 3 !== 0,
          latitude: 40 + (i % 10) * 0.5,
          longitude: -74 - (i % 10) * 0.5,
        },
      });
      await syncSpaceAmenities(prisma, created.id, testAmenityIds);
    }
    console.log(`Created ${toCreate} test listings for pagination (total spaces: ${targetTestListings}).`);
  }

  const spaces = await prisma.space.findMany({ take: 6 });
  if (spaces.length > 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const existingBooking = await prisma.booking.findFirst({
      where: { userId: guest.id, spaceId: spaces[0].id },
    });
    if (!existingBooking) {
      const { startMinutes, endMinutes } = resolveBookingMinutes('10:00 AM', '02:00 PM');
      await prisma.booking.create({
        data: {
          userId: guest.id,
          spaceId: spaces[0].id,
          date: tomorrow,
          startTime: '10:00 AM',
          endTime: '02:00 PM',
          startMinutes,
          endMinutes,
          status: 'confirmed',
          totalPrice: 380,
        },
      });
    }
  }

  console.log('Seed completed: users and spaces created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
