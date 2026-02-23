const prisma = require('../config/prisma');

// GET /api/dashboard/stats
const getStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const [
      todayRevenue,
      activeProducts,
      ordersToday,
      expiringProducts,
      newOrders,
      lowStockProducts,
      salesPerformance,
    ] = await Promise.all([
      // Today's revenue
      prisma.payment.aggregate({
        where: { tenantId, status: 'COMPLETED', paidAt: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      // Active products count
      prisma.product.count({ where: { tenantId, status: 'ACTIVE' } }),
      // Orders today
      prisma.order.count({ where: { tenantId, createdAt: { gte: today, lt: tomorrow } } }),
      // Expiring within 48h
      prisma.product.count({
        where: { tenantId, expiryDate: { gte: new Date(), lte: in48h }, status: 'ACTIVE' },
      }),
      // New orders (unaccepted)
      prisma.order.count({ where: { tenantId, status: 'NEW' } }),
      // Low stock items - fetch and filter client-side since Prisma can't compare two columns
      prisma.product.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { stock: true, minStock: true },
      }),
      // Sales performance last 7 days
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, SUM("totalAmount") as revenue
        FROM orders
        WHERE "tenantId" = ${tenantId}
          AND status NOT IN ('CANCELLED', 'RETURNED')
          AND "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    const lowStock = lowStockProducts.filter(p => p.stock <= p.minStock).length;

    res.json({
      success: true,
      data: {
        todayRevenue: todayRevenue._sum.amount || 0,
        activeProducts,
        ordersToday,
        expiringProducts,
        newOrders,
        lowStock,
        salesPerformance,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dashboard/action-needed
const getActionNeeded = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const [expiringCount, lowStockProducts, newOrdersCount] = await Promise.all([
      prisma.product.count({
        where: { tenantId, expiryDate: { gte: new Date(), lte: in48h }, status: 'ACTIVE' },
      }),
      prisma.product.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { stock: true, minStock: true },
      }),
      prisma.order.count({ where: { tenantId, status: 'NEW' } }),
    ]);

    const lowStockCount = lowStockProducts.filter(p => p.stock <= p.minStock).length;

    res.json({
      success: true,
      data: {
        expiringProducts: expiringCount,
        lowStock: lowStockCount,
        newOrders: newOrdersCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getStats, getActionNeeded };
