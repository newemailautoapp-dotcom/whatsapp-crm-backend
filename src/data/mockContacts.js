const now = Date.now();

export const INITIAL_CONTACTS = [
  {
    phone: '971501234567',
    name: 'Rashid Al-Maktoum',
    lastMessage: 'I am interested in the 2-bedroom apartment at Yas Island.',
    lastMessageTimestamp: now - 1000 * 60 * 5, // 5 mins ago
    unreadCount: 2,
    is24hActive: true,
    windowExpiry: now + 1000 * 60 * 60 * 20, // 20 hrs remaining
    tags: ['Interested', '20% ROI campaign', 'Hot Lead'],
    optedOut: false,
    notes: 'Inquired about Yas Island waterfront property. High budget, interested in 2BR payment plan.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    phone: '971559876543',
    name: 'Sarah Jenkins',
    lastMessage: 'Got the investment brochure. Can we schedule a viewing tomorrow?',
    lastMessageTimestamp: now - 1000 * 60 * 45, // 45 mins ago
    unreadCount: 0,
    is24hActive: true,
    windowExpiry: now + 1000 * 60 * 60 * 18,
    tags: ['Hot Lead', 'Yas Island Lead'],
    optedOut: false,
    notes: 'Requested brochure via Yas Island campaign. Prefers WhatsApp communication.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  },
  {
    phone: '971523334444',
    name: 'Vikram Sharma',
    lastMessage: '[Template Sent] Yas Island Real Estate Investment',
    lastMessageTimestamp: now - 1000 * 60 * 60 * 26, // 26 hrs ago (Expired 24h window)
    unreadCount: 0,
    is24hActive: false,
    windowExpiry: now - 1000 * 60 * 60 * 2, // Expired 2 hrs ago
    tags: ['Broadcast Leads', 'Investor'],
    optedOut: false,
    notes: '24-hour service window expired. Needs Meta Template to re-engage.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    phone: '971509998877',
    name: 'Elena Rostova',
    lastMessage: 'Please stop sending promotional messages.',
    lastMessageTimestamp: now - 1000 * 60 * 60 * 48,
    unreadCount: 0,
    is24hActive: false,
    windowExpiry: now - 1000 * 60 * 60 * 24,
    tags: ['Opt-Out'],
    optedOut: true,
    notes: 'Customer unsubscribed from marketing broadcast.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  }
];

export const INITIAL_MESSAGES = {
  '971501234567': [
    {
      id: 'msg_101',
      from: '971501234567',
      to: 'business',
      type: 'text',
      body: 'Hi, I saw your ad for Yas Island luxury waterfront apartments.',
      status: 'read',
      timestamp: now - 1000 * 60 * 15,
      direction: 'inbound'
    },
    {
      id: 'msg_102',
      from: 'business',
      to: '971501234567',
      type: 'text',
      body: 'Hello Rashid! Thanks for contacting us. We have 1, 2 & 3 bedroom luxury units available with 20% projected ROI. How many bedrooms are you considering?',
      status: 'read',
      timestamp: now - 1000 * 60 * 10,
      direction: 'outbound'
    },
    {
      id: 'msg_103',
      from: '971501234567',
      to: 'business',
      type: 'text',
      body: 'I am interested in the 2-bedroom apartment at Yas Island.',
      status: 'read',
      timestamp: now - 1000 * 60 * 5,
      direction: 'inbound'
    }
  ],
  '971559876543': [
    {
      id: 'msg_201',
      from: 'business',
      to: '971559876543',
      type: 'template',
      templateName: 'yas_island_leads_campaign',
      body: 'Hello Sarah! Exclusive Yas Island luxury waterfront apartments are now open for pre-launch booking with up to 20% ROI forecast. Would you like to receive our detailed investor brochure?',
      status: 'read',
      timestamp: now - 1000 * 60 * 120,
      direction: 'outbound'
    },
    {
      id: 'msg_202',
      from: '971559876543',
      to: 'business',
      type: 'button_reply',
      body: 'Get Investment Details',
      status: 'read',
      timestamp: now - 1000 * 60 * 90,
      direction: 'inbound'
    },
    {
      id: 'msg_203',
      from: '971559876543',
      to: 'business',
      type: 'text',
      body: 'Got the investment brochure. Can we schedule a viewing tomorrow?',
      status: 'read',
      timestamp: now - 1000 * 60 * 45,
      direction: 'inbound'
    }
  ],
  '971523334444': [
    {
      id: 'msg_301',
      from: 'business',
      to: '971523334444',
      type: 'template',
      templateName: 'yas_island_leads_campaign',
      body: 'Hello Vikram! Exclusive Yas Island luxury waterfront apartments are now open for pre-launch booking with up to 20% ROI forecast. Would you like to receive our detailed investor brochure?',
      status: 'delivered',
      timestamp: now - 1000 * 60 * 60 * 26,
      direction: 'outbound'
    }
  ],
  '971509998877': [
    {
      id: 'msg_401',
      from: '971509998877',
      to: 'business',
      type: 'text',
      body: 'Please stop sending promotional messages.',
      status: 'read',
      timestamp: now - 1000 * 60 * 60 * 48,
      direction: 'inbound'
    }
  ]
};
