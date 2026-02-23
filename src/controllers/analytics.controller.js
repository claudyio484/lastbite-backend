const prisma = require('../config/prisma');

// GET /api/analytics/overview
const getOverview = async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const tenantId = req.tenantId;

    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalRevenue, totalOrders, bestSellingProducts, foodWasteStats] = await Promise.all([
      prisma.payment.aggregate({
        where: { tenantId, status: 'COMPLETED', paidAt: { gte: since } },
        _sum: { amount: true },
      }),
      prisma.order.count({
        where: { tenantId, status: { in: ['DELIVERED'] }, createdAt: { gte: since } },
      }),
      // Best selling products
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { order: { tenantId, status: 'DELIVERED', createdAt: { gte: since } } },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      // Food waste: saved vs expired
      Promise.all([
        prisma.product.count({ where: { tenantId, status: 'ACTIVE', expiryDate: { gte: new Date() } } }),
        prisma.product.count({ where: { tenantId, status: 'EXPIRED' } }),
      ]),
    ]);

    const [savedCount, expiredCount] = foodWasteStats;
    const totalFoodItems = savedCount + expiredCount || 1;
    const savedPct = Math.round((savedCount / totalFoodItems) * 100);

    // Revenue overview chart (daily)
    const revenueChart = await prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE("createdAt" AT TIME ZONE 'Asia/Dubai'), 'Dy') as day,
        COALESCE(SUM("totalAmount"), 0) as revenue
      FROM orders
      WHERE "tenantId" = ${tenantId}
        AND status = 'DELIVERED'
        AND "createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY DATE("createdAt" AT TIME ZONE 'Asia/Dubai')
      ORDER BY DATE("createdAt" AT TIME ZONE 'Asia/Dubai') ASC
    `;

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue._sum.amount || 0,
        totalOrders,
        customerRating: 4.8, // placeholder until reviews system
        foodWaste: {
          savedPct,
          saved: savedCount,
          discarded: expiredCount,
          savedKg: savedCount * 0.5, // estimate
        },
        revenueChart,
        bestSellingProducts: bestSellingProducts.map(p => ({
          productId: p.productId,
          name: p.productName,
          unitsSold: p._sum.quantity,
          revenue: p._sum.totalPrice,
        })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getOverview };
