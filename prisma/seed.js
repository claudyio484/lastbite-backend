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

  // Create sample customers
  const customer1 = await prisma.user.upsert({
    where: { email: 'omar.k@example.com' },
    update: {},
    create: {
      email: 'omar.k@example.com',
      password: await bcrypt.hash('Password@123', 12),
      firstName: 'Omar',
      lastName: 'Khalid',
      role: 'CUSTOMER',
      phone: '+971505551234',
      isVerified: true,
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'sophia.l@example.com' },
    update: {},
    create: {
      email: 'sophia.l@example.com',
      password: await bcrypt.hash('Password@123', 12),
      firstName: 'Sophia',
      lastName: 'Lee',
      role: 'CUSTOMER',
      phone: '+971529991111',
      isVerified: true,
    },
  });

  const customer3 = await prisma.user.upsert({
    where: { email: 'sarah.ahmed@example.com' },
    update: {},
    create: {
      email: 'sarah.ahmed@example.com',
      password: await bcrypt.hash('Password@123', 12),
      firstName: 'Sarah',
      lastName: 'Ahmed',
      role: 'CUSTOMER',
      phone: '+971501234567',
      isVerified: true,
    },
  });

  // Create sample orders with real Dubai coordinates
  const sampleOrders = [
    {
      customerId: customer1.id,
      orderNumber: '#4040',
      type: 'DELIVERY',
      status: 'NEW',
      subtotal: 95.00,
      taxAmount: 4.75,
      totalAmount: 99.75,
      shippingAddress: { address: 'Villa 12, Jumeirah 1', notes: 'Blue gate' },
      lat: 25.2285,
      lng: 55.2530,
      items: [
        { productName: 'Lamb Chops', quantity: 2, unitPrice: 45.00, totalPrice: 90.00 },
        { productName: 'Mint Leaves', quantity: 1, unitPrice: 5.00, totalPrice: 5.00 },
      ],
    },
    {
      customerId: customer2.id,
      orderNumber: '#4039',
      type: 'DELIVERY',
      status: 'NEW',
      subtotal: 105.00,
      taxAmount: 5.25,
      totalAmount: 110.25,
      shippingAddress: { address: 'Apt 505, JLT Cluster C', notes: 'Code 1234' },
      lat: 25.0770,
      lng: 55.1535,
      items: [
        { productName: 'Sushi Platter', quantity: 1, unitPrice: 95.00, totalPrice: 95.00 },
        { productName: 'Green Tea', quantity: 2, unitPrice: 5.00, totalPrice: 10.00 },
      ],
    },
    {
      customerId: customer3.id,
      orderNumber: '#4029',
      type: 'PICKUP',
      status: 'READY',
      subtotal: 39.00,
      taxAmount: 1.95,
      totalAmount: 40.95,
      shippingAddress: { address: 'In-Store Pickup', notes: 'Counter 2, Main Entrance' },
      lat: 25.1880,
      lng: 55.2625,
      notes: 'Please double bag the milk.',
      items: [
        { productName: 'Organic Milk', quantity: 2, unitPrice: 12.00, totalPrice: 24.00 },
        { productName: 'Sourdough Bread', quantity: 1, unitPrice: 15.00, totalPrice: 15.00 },
      ],
    },
    {
      customerId: customer1.id,
      orderNumber: '#4035',
      type: 'DELIVERY',
      status: 'OUT_FOR_DELIVERY',
      subtotal: 55.00,
      taxAmount: 2.75,
      totalAmount: 57.75,
      shippingAddress: { address: 'Apt 1001, Downtown Views', notes: 'Leave at reception' },
      lat: 25.1972,
      lng: 55.2744,
      items: [
        { productName: 'Bok Choy', quantity: 4, unitPrice: 6.00, totalPrice: 24.00 },
        { productName: 'Tofu', quantity: 2, unitPrice: 8.00, totalPrice: 16.00 },
        { productName: 'Soy Sauce', quantity: 1, unitPrice: 15.00, totalPrice: 15.00 },
      ],
    },
    {
      customerId: customer2.id,
      orderNumber: '#4036',
      type: 'PICKUP',
      status: 'PREPARING',
      subtotal: 75.00,
      taxAmount: 3.75,
      totalAmount: 78.75,
      shippingAddress: { address: 'In-Store Pickup', notes: 'Drive-through' },
      lat: 25.1880,
      lng: 55.2625,
      items: [
        { productName: 'Rotisserie Chicken', quantity: 1, unitPrice: 35.00, totalPrice: 35.00 },
        { productName: 'Caesar Salad', quantity: 2, unitPrice: 20.00, totalPrice: 40.00 },
      ],
    },
  ];

  for (const orderData of sampleOrders) {
    const { items, ...data } = orderData;
    const existing = await prisma.order.findUnique({ where: { orderNumber: data.orderNumber } });
    if (!existing) {
      await prisma.order.create({
        data: {
          tenantId: tenant.id,
          ...data,
          items: { create: items.map(i => ({ ...i, productId: null })) },
        },
      });
    }
  }

  console.log('✅ Sample orders created with Dubai coordinates');
  console.log('✅ Demo merchant created: joe@mygrocery.ae / Password@123');
  console.log('✅ Super admin: admin@lastbite.ae / Admin@123456');
  console.log('🎉 Seed completed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
