const prisma = require('../config/prisma');

// GET /api/notifications - list with filters (All, Orders, Alerts, Messages)
const getNotifications = async (req, res) => {
  try {
    const { type, date, page = 1, limit = 20 } = req.query;
    const tenantId = req.tenantId;

    const where = { tenantId };

    if (type && type !== 'All') {
      const typeMap = {
        Orders: ['NEW_ORDER'],
        Alerts: ['LOW_STOCK', 'PRODUCT_EXPIRING', 'SUBSCRIPTION'],
        Messages: ['NEW_MESSAGE'],
      };
      if (typeMap[type]) where.type = { in: typeMap[type] };
    }

    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { tenantId, isRead: false } }),
    ]);

    res.json({ success: true, data: notifications, unreadCount, pagination: { total, page: parseInt(page) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/notifications/preview - top 5 for bell dropdown
const getPreview = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const unreadCount = await prisma.notification.count({
      where: { tenantId: req.tenantId, isRead: false },
    });
    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    // Verify the notification belongs to this tenant
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/notifications/mark-all-read
const markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { tenantId: req.tenantId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Internal helper - called by other controllers to create notifications
const createNotification = async (tenantId, { type, title, body, entityId, priority = 'normal' }) => {
  try {
    await prisma.notification.create({
      data: { tenantId, type, title, body, entityId, priority },
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

module.exports = { getNotifications, getPreview, markAsRead, markAllRead, createNotification };
