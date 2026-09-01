export const META_TEMPLATES = [
  {
    id: 'yas_island_leads_campaign',
    name: 'yas_island_leads_campaign',
    category: 'MARKETING',
    language: 'en_US',
    title: 'Yas Island Real Estate Investment',
    body: 'Hello {{1}}! Exclusive Yas Island luxury waterfront apartments are now open for pre-launch booking with up to 20% ROI forecast. Would you like to receive our detailed investor brochure?',
    placeholders: ['Customer Name'],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Get Investment Details', payload: 'PAYLOAD_GET_INVESTMENT_DETAILS' },
      { type: 'QUICK_REPLY', text: 'Talk to Advisor', payload: 'PAYLOAD_TALK_TO_ADVISOR' }
    ]
  },
  {
    id: 'welcome_offer',
    name: 'welcome_offer',
    category: 'MARKETING',
    language: 'en_US',
    title: 'Welcome Special Offer',
    body: 'Hi {{1}}, welcome to our VIP Real Estate Network! Enjoy priority access to new property listings with code {{2}}.',
    placeholders: ['Customer Name', 'Promo Code'],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Claim Offer', payload: 'PAYLOAD_CLAIM_OFFER' }
    ]
  },
  {
    id: 'appointment_reminder',
    name: 'appointment_reminder',
    category: 'UTILITY',
    language: 'en_US',
    title: 'Appointment Reminder',
    body: 'Hello {{1}}, this is a friendly reminder for your scheduled property viewing on {{2}} at {{3}}.',
    placeholders: ['Customer Name', 'Date', 'Time'],
    buttons: []
  },
  {
    id: 'general_followup',
    name: 'general_followup',
    category: 'UTILITY',
    language: 'en_US',
    title: 'General Follow-up',
    body: 'Hi {{1}}, following up on your recent inquiry. Please let us know if you need any additional details or assistance!',
    placeholders: ['Customer Name'],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Request Call Back', payload: 'PAYLOAD_REQUEST_CALLBACK' }
    ]
  }
];
