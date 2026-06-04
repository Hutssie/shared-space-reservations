import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const s = await prisma.space.findFirst({
  where: { status: 'active', isInstantBookable: true },
  select: { id: true, title: true },
});
console.log(s ? `${s.id}\t${s.title}` : 'No instant-bookable space found');
await prisma.$disconnect();
