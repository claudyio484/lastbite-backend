const prisma = require('../config/prisma');

// GET /api/messages/conversations
const getConversations = async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { tenantId: req.tenantId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMsgAt: 'desc' },
    });

    // Get unread count per conversation
    const withUnread = await Promise.all(conversations.map(async (conv) => {
      const unread = await prisma.message.count({
        where: { conversationId: conv.id, isRead: false, senderId: { not: req.user.id } },
      });
      return { ...conv, unreadCount: unread };
    }));

    res.json({ success: true, data: withUnread });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/messages/conversations/:id
const getMessages = async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      include: { sender: { select: { firstName: true, lastName: true, avatar: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Mark as read
    await prisma.message.updateMany({
      where: { conversationId: req.params.id, senderId: { not: req.user.id }, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/messages/conversations/:id/send
const sendMessage = async (req, res) => {
  try {
    const { body } = req.body;

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user.id,
        body,
      },
      include: { sender: { select: { firstName: true, lastName: true, avatar: true } } },
    });

    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { lastMsgAt: new Date() },
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/messages/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true },
    });

    const count = await prisma.message.count({
      where: {
        conversationId: { in: conversations.map(c => c.id) },
        isRead: false,
        senderId: { not: req.user.id },
      },
    });

    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getConversations, getMessages, sendMessage, getUnreadCount };
