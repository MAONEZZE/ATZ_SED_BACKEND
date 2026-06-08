import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed profile (test organizer)
  const profile = await prisma.profile.upsert({
    where: { userId: 'test-user-id-000001' },
    update: {},
    create: {
      userId: 'test-user-id-000001',
      name: 'Organizador Teste',
      email: 'organizador@teste.com',
    },
  });

  // Seed event
  const event = await prisma.event.upsert({
    where: { slug: 'evento-teste-000001' },
    update: {},
    create: {
      ownerId: profile.id,
      title: 'Evento Teste',
      slug: 'evento-teste-000001',
      description: 'Evento para desenvolvimento e testes',
      status: 'draft',
      capacity: 100,
      location: 'São Paulo, SP',
    },
  });

  // Seed form fields (fixed)
  await prisma.formField.createMany({
    skipDuplicates: true,
    data: [
      { eventId: event.id, label: 'Nome', type: 'text', required: true, isFixed: true, order: 0 },
      { eventId: event.id, label: 'Telefone', type: 'phone', required: true, isFixed: true, order: 1 },
      { eventId: event.id, label: 'E-mail', type: 'email', required: true, isFixed: true, order: 2 },
      { eventId: event.id, label: 'Endereço', type: 'text', required: false, isFixed: true, order: 3 },
    ],
  });

  // Seed landing page
  const existingLanding = await prisma.landingPage.findUnique({ where: { eventId: event.id } });
  if (!existingLanding) {
    await prisma.landingPage.create({
      data: {
        eventId: event.id,
        sections: {
          create: [
            { type: 'hero', order: 0, enabled: true },
            { type: 'about', order: 1, enabled: true },
            { type: 'registration', order: 2, enabled: true },
            { type: 'speakers', order: 3, enabled: false },
            { type: 'schedule', order: 4, enabled: false },
            { type: 'venue', order: 5, enabled: false },
            { type: 'faq', order: 6, enabled: false },
            { type: 'gallery', order: 7, enabled: false },
            { type: 'testimonials', order: 8, enabled: false },
            { type: 'sponsors', order: 9, enabled: false },
          ],
        },
      },
    });
  }

  // Seed a message template
  await prisma.messageTemplate.upsert({
    where: { id: 'seed-template-001' },
    update: {},
    create: {
      id: 'seed-template-001',
      eventId: event.id,
      name: 'Confirmação de Inscrição',
      channel: 'email',
      subject: 'Sua inscrição em {{evento}} foi recebida!',
      body: '<p>Olá {{nome}}, sua inscrição no evento {{evento}} foi recebida com sucesso! Em breve entraremos em contato.</p>',
    },
  });

  console.log('Seed complete:', { profileId: profile.id, eventId: event.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
