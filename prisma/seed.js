const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@lastbite.ae' },
    update: {},
    create: {
      email: 'admin@lastbite.ae',
      password: await bcrypt.hash('Admin@123456', 12),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isVerified: true,
    },
  });
  console.log('✅ Super admin created:', superAdmin.email);

  // Create demo merchant (My Grocery)
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'my-grocery' },
    update: {},
    create: {
      name: "Joe's Grocery",
      slug: 'my-grocery',
      email: 'joe@mygrocery.ae',
      phone: '+971501234567',
      city: 'Dubai',
      address: 'P.O. Box 12345, Business Bay, Dubai, UAE',
    },
  });

  // Create subscription
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      plan: 'PROFESSIONAL',
      status: 'TRIAL',
      priceAed: 99,
      commissionRate: 0,
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Create merchant owner
  await prisma.user.upsert({
    where: { email: 'joe@mygrocery.ae' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'joe@mygrocery.ae',
      password: await bcrypt.hash('Password@123', 12),
      firstName: 'Joe',
      lastName: 'Doe',
      role: 'MERCHANT_OWNER',
      phone: '+971501234567',
      jobTitle: 'Owner',
      isVerified: true,
    },
  });

  // Create categories
  const categoryNames = ['Produce', 'Dairy', 'Bakery', 'Meat', 'Pantry'];
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: name.toLowerCase() } },
      update: {},
      create: { tenantId: tenant.id, name, slug: name.toLowerCase() },
    });
  }

  console.log('✅ Demo merchant created: joe@mygrocery.ae / Password@123');
  console.log('✅ Super admin: admin@lastbite.ae / Admin@123456');
  console.log('🎉 Seed completed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
