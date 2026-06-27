/**
 * Development seed — one user, one work space, a couple of contacts, and a few
 * loops spanning statuses so screens have realistic data. Idempotent on email.
 * Run: `npm run db:seed` (requires DATABASE_URL).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'karan@example.com' },
    update: {},
    create: { name: 'Karan', email: 'karan@example.com', timezone: 'Asia/Kolkata' },
  });

  const space = await prisma.space.create({
    data: { type: 'work', ownerUserId: user.id },
  });

  await prisma.membership.create({
    data: { userId: user.id, spaceId: space.id, role: 'owner' },
  });

  const clients = await prisma.group.create({ data: { spaceId: space.id, name: 'Clients' } });

  const raj = await prisma.contact.create({
    data: {
      spaceId: space.id,
      name: 'Raj',
      email: 'raj@example.com',
      whatsapp: '+919900000001',
      groupId: clients.id,
      createdById: user.id,
    },
  });

  const ca = await prisma.contact.create({
    data: {
      spaceId: space.id,
      name: 'CA (Mehta & Co)',
      email: 'mehta@example.com',
      createdById: user.id,
    },
  });

  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 86400000);

  // Awaiting loop with a scheduled follow-up.
  const loop1 = await prisma.loop.create({
    data: {
      spaceId: space.id,
      title: 'Signed contract from Raj',
      ask: 'Send the signed services contract',
      definitionOfDone: 'Signed PDF received',
      deadline: inDays(3),
      priority: 'High',
      status: 'Awaiting',
      channel: 'email',
      source: 'manual',
      waitingSince: now,
      nextFollowupAt: inDays(2),
      orderIndex: 0,
      createdById: user.id,
      owners: { create: [{ contactId: raj.id, subStatus: 'Awaiting' }] },
    },
  });
  await prisma.touch.create({ data: { loopId: loop1.id, type: 'created' } });
  await prisma.reminder.create({
    data: { loopId: loop1.id, dueAt: inDays(2), kind: 'followup', state: 'scheduled' },
  });

  // Overdue GST filing.
  await prisma.loop.create({
    data: {
      spaceId: space.id,
      title: 'GST filing',
      ask: 'File this month’s GST return',
      definitionOfDone: 'Filing acknowledgement number received',
      deadline: inDays(-1),
      priority: 'Critical',
      status: 'Awaiting',
      channel: 'whatsapp',
      source: 'manual',
      waitingSince: inDays(-4),
      nextFollowupAt: inDays(-1),
      orderIndex: 1,
      createdById: user.id,
      owners: { create: [{ contactId: ca.id, subStatus: 'Awaiting' }] },
    },
  });

  // A closed loop (counts toward WCL).
  await prisma.loop.create({
    data: {
      spaceId: space.id,
      title: 'Quotation from vendor',
      ask: 'Send quotation for the new order',
      definitionOfDone: 'Quotation received and approved',
      priority: 'Medium',
      status: 'Closed',
      channel: 'email',
      source: 'manual',
      completedAt: inDays(-2),
      closedAt: inDays(-1),
      orderIndex: 2,
      createdById: user.id,
      owners: { create: [{ contactId: raj.id, subStatus: 'Responded', respondedAt: inDays(-2) }] },
    },
  });

  // A daily routine with a streak.
  await prisma.routine.create({
    data: { userId: user.id, title: 'Review open loops', streakCount: 3, timezone: 'Asia/Kolkata' },
  });

  console.log(`Seeded space ${space.id} for ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
