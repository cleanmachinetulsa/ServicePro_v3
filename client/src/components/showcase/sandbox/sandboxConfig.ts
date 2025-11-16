export interface Message {
  id: string;
  text: string;
  sender: 'customer' | 'agent';
  timestamp: Date;
}

export interface TimelineEvent {
  id: string;
  type: 'sms' | 'email' | 'rule' | 'schedule' | 'tag';
  message: string;
  timestamp: Date;
  details?: string;
}

export type SandboxMode = 'free' | 'new-lead' | 'rain-reschedule' | 'follow-up' | 'upsell';

export type ConversationState = 
  | 'greeting'
  | 'collecting_name'
  | 'collecting_address'
  | 'offering_slots'
  | 'confirming'
  | 'reschedule_options'
  | 'review_request'
  | 'upsell_pitch'
  | 'completed';

export const MODES = [
  { id: 'free' as const, label: 'Free Play' },
  { id: 'new-lead' as const, label: 'New Lead → Booking' },
  { id: 'rain-reschedule' as const, label: 'Rain Reschedule' },
  { id: 'follow-up' as const, label: 'Follow-Up & Reviews' },
  { id: 'upsell' as const, label: 'Upsell & Packages' }
];

export const QUICK_SUGGESTIONS: Record<SandboxMode, string[]> = {
  'free': [
    'Need a detail',
    'How much for exterior?',
    'Available tomorrow?'
  ],
  'new-lead': [
    'Full detail for my sedan',
    'John Smith',
    '123 Main St, Boston MA'
  ],
  'rain-reschedule': [
    'Reschedule please',
    'Move indoors',
    'Keep the original time'
  ],
  'follow-up': [
    'Sure, happy to review!',
    'Can I get a discount?',
    'What about maintenance?'
  ],
  'upsell': [
    'Tell me about ceramic coating',
    'How much for membership?',
    'Not interested right now'
  ]
};

export const INITIAL_MESSAGES: Record<SandboxMode, Message[]> = {
  'free': [
    {
      id: '1',
      text: 'Thanks for reaching out! How can I help you today?',
      sender: 'agent',
      timestamp: new Date()
    }
  ],
  'new-lead': [
    {
      id: '1',
      text: 'Thanks for reaching out! What are we working on today?',
      sender: 'agent',
      timestamp: new Date()
    }
  ],
  'rain-reschedule': [
    {
      id: '1',
      text: 'Weather forecast shows 80% chance of rain tomorrow for your appointment. Three options: (1) Keep it and brave the weather, (2) Move to an indoor location if you have a garage, or (3) Reschedule for free. What works best for you?',
      sender: 'agent',
      timestamp: new Date()
    }
  ],
  'follow-up': [
    {
      id: '1',
      text: 'Hope you\'re loving your freshly detailed car! 🚗✨ Mind taking 30 seconds to leave us a quick review? It really helps us out!',
      sender: 'agent',
      timestamp: new Date()
    }
  ],
  'upsell': [
    {
      id: '1',
      text: 'Your car looks amazing! By the way, we have a ceramic coating special this month - keeps that shine for up to 5 years. Want to hear more about it?',
      sender: 'agent',
      timestamp: new Date()
    }
  ]
};

export const INITIAL_EVENTS: Record<SandboxMode, TimelineEvent[]> = {
  'free': [
    {
      id: 'e1',
      type: 'sms',
      message: 'Conversation started',
      timestamp: new Date(),
      details: 'Customer initiated contact via SMS'
    }
  ],
  'new-lead': [
    {
      id: 'e1',
      type: 'sms',
      message: 'New lead detected',
      timestamp: new Date(),
      details: 'Customer type: Unknown, initiating qualification flow'
    },
    {
      id: 'e2',
      type: 'tag',
      message: 'Applied: New Lead tag',
      timestamp: new Date(),
      details: 'Status: collecting_info'
    }
  ],
  'rain-reschedule': [
    {
      id: 'e1',
      type: 'rule',
      message: 'Weather check triggered',
      timestamp: new Date(),
      details: 'Rain probability: 80%, outdoor appointment detected'
    },
    {
      id: 'e2',
      type: 'sms',
      message: 'Reschedule options sent',
      timestamp: new Date(),
      details: 'Offering: keep, indoor, or reschedule'
    }
  ],
  'follow-up': [
    {
      id: 'e1',
      type: 'schedule',
      message: 'Post-service follow-up triggered',
      timestamp: new Date(),
      details: 'Job completed 2 hours ago, optimal time for review request'
    },
    {
      id: 'e2',
      type: 'sms',
      message: 'Review request sent',
      timestamp: new Date(),
      details: 'Platform: Google Reviews'
    }
  ],
  'upsell': [
    {
      id: 'e1',
      type: 'rule',
      message: 'Upsell opportunity detected',
      timestamp: new Date(),
      details: 'Vehicle type: Luxury sedan, high-value customer'
    },
    {
      id: 'e2',
      type: 'sms',
      message: 'Ceramic coating offer sent',
      timestamp: new Date(),
      details: 'Promotion: 15% off if added today'
    }
  ]
};
