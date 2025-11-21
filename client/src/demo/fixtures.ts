/**
 * Demo Mode Mock Data Fixtures
 * Comprehensive mock data for "Acme Detailing" white-label demonstration
 * 
 * Security: This data is isolated and never touches real database
 */

// Mock Customers (15+ realistic profiles)
export const mockCustomers = [
  {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "+1555012" 
,
    address: "123 Oak Street, Austin, TX 78701",
    vehicleInfo: "2022 Tesla Model 3 - White",
    loyaltyPoints: 850,
    tier: "gold",
    totalAppointments: 8,
    lifetimeValue: 1240.00,
    lastVisit: "2025-11-15",
  },
  {
    id: 2,
    name: "Michael Chen",
    email: "m.chen@business.com",
    phone: "+15550123457",
    address: "456 Maple Ave, Austin, TX 78702",
    vehicleInfo: "2023 BMW X5 - Black",
    loyaltyPoints: 1200,
    tier: "platinum",
    totalAppointments: 12,
    lifetimeValue: 2150.00,
    lastVisit: "2025-11-18",
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    email: "emily.r@mail.com",
    phone: "+15550234568",
    address: "789 Pine Road, Austin, TX 78703",
    vehicleInfo: "2021 Honda CR-V - Silver",
    loyaltyPoints: 420,
    tier: "silver",
    totalAppointments: 5,
    lifetimeValue: 650.00,
    lastVisit: "2025-11-12",
  },
  {
    id: 4,
    name: "David Martinez",
    email: "dmartinez@company.net",
    phone: "+15550345679",
    address: "321 Elm Street, Austin, TX 78704",
    vehicleInfo: "2024 Mercedes GLE - Gray",
    loyaltyPoints: 2100,
    tier: "platinum",
    totalAppointments: 15,
    lifetimeValue: 3200.00,
    lastVisit: "2025-11-19",
  },
  {
    id: 5,
    name: "Jessica Taylor",
    email: "jtaylor@webmail.com",
    phone: "+15550456780",
    address: "654 Birch Lane, Austin, TX 78705",
    vehicleInfo: "2020 Toyota Camry - Blue",
    loyaltyPoints: 180,
    tier: "bronze",
    totalAppointments: 2,
    lifetimeValue: 280.00,
    lastVisit: "2025-10-28",
  },
  {
    id: 6,
    name: "Robert Williams",
    email: "rwilliams@corp.com",
    phone: "+15550567891",
    address: "987 Cedar Drive, Austin, TX 78706",
    vehicleInfo: "2023 Audi Q7 - White",
    loyaltyPoints: 950,
    tier: "gold",
    totalAppointments: 9,
    lifetimeValue: 1580.00,
    lastVisit: "2025-11-14",
  },
  {
    id: 7,
    name: "Amanda Brown",
    email: "amanda.b@email.net",
    phone: "+15550678902",
    address: "246 Willow Court, Austin, TX 78707",
    vehicleInfo: "2022 Ford F-150 - Red",
    loyaltyPoints: 620,
    tier: "silver",
    totalAppointments: 6,
    lifetimeValue: 920.00,
    lastVisit: "2025-11-10",
  },
  {
    id: 8,
    name: "Christopher Lee",
    email: "c.lee@business.org",
    phone: "+15550789013",
    address: "135 Spruce Ave, Austin, TX 78708",
    vehicleInfo: "2023 Lexus RX - Black",
    loyaltyPoints: 1450,
    tier: "platinum",
    totalAppointments: 11,
    lifetimeValue: 2380.00,
    lastVisit: "2025-11-17",
  },
  {
    id: 9,
    name: "Lisa Anderson",
    email: "lisa.anderson@mail.com",
    phone: "+15550890124",
    address: "579 Ash Boulevard, Austin, TX 78709",
    vehicleInfo: "2021 Jeep Wrangler - Green",
    loyaltyPoints: 340,
    tier: "bronze",
    totalAppointments: 4,
    lifetimeValue: 480.00,
    lastVisit: "2025-11-05",
  },
  {
    id: 10,
    name: "James Wilson",
    email: "jwilson@enterprise.com",
    phone: "+15550901235",
    address: "802 Poplar Street, Austin, TX 78710",
    vehicleInfo: "2024 Porsche Cayenne - Silver",
    loyaltyPoints: 2850,
    tier: "platinum",
    totalAppointments: 18,
    lifetimeValue: 4200.00,
    lastVisit: "2025-11-20",
  },
  {
    id: 11,
    name: "Maria Garcia",
    email: "mgarcia@webservice.com",
    phone: "+15551012346",
    address: "413 Magnolia Way, Austin, TX 78711",
    vehicleInfo: "2022 Nissan Rogue - White",
    loyaltyPoints: 520,
    tier: "silver",
    totalAppointments: 5,
    lifetimeValue: 750.00,
    lastVisit: "2025-11-08",
  },
  {
    id: 12,
    name: "Daniel Thompson",
    email: "d.thompson@mail.net",
    phone: "+15551123457",
    address: "768 Sycamore Road, Austin, TX 78712",
    vehicleInfo: "2023 Volvo XC90 - Blue",
    loyaltyPoints: 1680,
    tier: "platinum",
    totalAppointments: 13,
    lifetimeValue: 2650.00,
    lastVisit: "2025-11-16",
  },
  {
    id: 13,
    name: "Rachel Kim",
    email: "rkim@business.co",
    phone: "+15551234568",
    address: "951 Hickory Lane, Austin, TX 78713",
    vehicleInfo: "2021 Mazda CX-5 - Gray",
    loyaltyPoints: 280,
    tier: "bronze",
    totalAppointments: 3,
    lifetimeValue: 420.00,
    lastVisit: "2025-10-22",
  },
  {
    id: 14,
    name: "Kevin Patel",
    email: "kpatel@company.com",
    phone: "+15551345679",
    address: "357 Dogwood Court, Austin, TX 78714",
    vehicleInfo: "2024 Acura MDX - Black",
    loyaltyPoints: 1120,
    tier: "gold",
    totalAppointments: 10,
    lifetimeValue: 1850.00,
    lastVisit: "2025-11-13",
  },
  {
    id: 15,
    name: "Nicole Turner",
    email: "nturner@email.com",
    phone: "+15551456780",
    address: "842 Juniper Drive, Austin, TX 78715",
    vehicleInfo: "2022 Subaru Outback - Green",
    loyaltyPoints: 720,
    tier: "gold",
    totalAppointments: 7,
    lifetimeValue: 1080.00,
    lastVisit: "2025-11-11",
  },
  {
    id: 16,
    name: "Brandon Scott",
    email: "bscott@mail.org",
    phone: "+15551567891",
    address: "526 Redwood Ave, Austin, TX 78716",
    vehicleInfo: "2023 Chevrolet Tahoe - White",
    loyaltyPoints: 1890,
    tier: "platinum",
    totalAppointments: 14,
    lifetimeValue: 2980.00,
    lastVisit: "2025-11-19",
  },
];

// Mock Conversations (20+ across different platforms)
export const mockConversations = [
  {
    id: 1,
    customerId: 1,
    customerName: "Sarah Johnson",
    platform: "sms",
    lastMessage: "Perfect! See you tomorrow at 2pm",
    lastMessageAt: "2025-11-20T14:30:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "customer", text: "Hi! I'd like to book a full detail for tomorrow", timestamp: "2025-11-20T14:15:00Z" },
      { id: 2, from: "business", text: "Hi Sarah! I have 2pm or 4pm available tomorrow. Which works better for you?", timestamp: "2025-11-20T14:18:00Z" },
      { id: 3, from: "customer", text: "2pm would be perfect!", timestamp: "2025-11-20T14:25:00Z" },
      { id: 4, from: "business", text: "Perfect! See you tomorrow at 2pm", timestamp: "2025-11-20T14:28:00Z" },
    ],
  },
  {
    id: 2,
    customerId: 2,
    customerName: "Michael Chen",
    platform: "web",
    lastMessage: "Thank you! The ceramic coating looks amazing",
    lastMessageAt: "2025-11-19T16:45:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "customer", text: "How long does the ceramic coating last?", timestamp: "2025-11-19T15:30:00Z" },
      { id: 2, from: "business", text: "Our ceramic coating lasts 2-3 years with proper care. It provides excellent protection against UV rays, chemicals, and minor scratches.", timestamp: "2025-11-19T15:35:00Z" },
      { id: 3, from: "customer", text: "That sounds great! I'll book it for next week", timestamp: "2025-11-19T16:40:00Z" },
      { id: 4, from: "customer", text: "Thank you! The ceramic coating looks amazing", timestamp: "2025-11-19T16:45:00Z" },
    ],
  },
  {
    id: 3,
    customerId: 3,
    customerName: "Emily Rodriguez",
    platform: "facebook",
    lastMessage: "Can I add interior shampoo to my appointment?",
    lastMessageAt: "2025-11-20T10:20:00Z",
    unreadCount: 1,
    messages: [
      { id: 1, from: "customer", text: "Hi! I have an appointment tomorrow", timestamp: "2025-11-20T10:15:00Z" },
      { id: 2, from: "customer", text: "Can I add interior shampoo to my appointment?", timestamp: "2025-11-20T10:20:00Z" },
    ],
  },
  {
    id: 4,
    customerId: 4,
    customerName: "David Martinez",
    platform: "sms",
    lastMessage: "On my way! ETA 5 minutes",
    lastMessageAt: "2025-11-20T13:55:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "business", text: "Hi David! Your appointment is scheduled for 2pm today. See you soon!", timestamp: "2025-11-20T09:00:00Z" },
      { id: 2, from: "customer", text: "Thanks! I'll be there", timestamp: "2025-11-20T09:15:00Z" },
      { id: 3, from: "business", text: "On my way! ETA 5 minutes", timestamp: "2025-11-20T13:55:00Z" },
    ],
  },
  {
    id: 5,
    customerId: 5,
    customerName: "Jessica Taylor",
    platform: "instagram",
    lastMessage: "What are your prices for SUV interior detail?",
    lastMessageAt: "2025-11-20T11:30:00Z",
    unreadCount: 1,
    messages: [
      { id: 1, from: "customer", text: "I saw your work on Instagram - looks great!", timestamp: "2025-11-20T11:20:00Z" },
      { id: 2, from: "customer", text: "What are your prices for SUV interior detail?", timestamp: "2025-11-20T11:30:00Z" },
    ],
  },
  {
    id: 6,
    customerId: 6,
    customerName: "Robert Williams",
    platform: "sms",
    lastMessage: "Yes, I can bring it by at 10am",
    lastMessageAt: "2025-11-19T19:20:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "business", text: "Hi Robert! We have your paint correction scheduled for Friday. Can you drop off the car at 10am?", timestamp: "2025-11-19T18:00:00Z" },
      { id: 2, from: "customer", text: "Yes, I can bring it by at 10am", timestamp: "2025-11-19T19:20:00Z" },
    ],
  },
  {
    id: 7,
    customerId: 7,
    customerName: "Amanda Brown",
    platform: "web",
    lastMessage: "The truck looks brand new! Thank you so much",
    lastMessageAt: "2025-11-18T17:30:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "customer", text: "Just picked up my truck - WOW!", timestamp: "2025-11-18T17:25:00Z" },
      { id: 2, from: "customer", text: "The truck looks brand new! Thank you so much", timestamp: "2025-11-18T17:30:00Z" },
      { id: 3, from: "business", text: "We're so glad you love it! Thank you for choosing us!", timestamp: "2025-11-18T17:35:00Z" },
    ],
  },
  {
    id: 8,
    customerId: 8,
    customerName: "Christopher Lee",
    platform: "sms",
    lastMessage: "That works perfectly!",
    lastMessageAt: "2025-11-20T08:45:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "business", text: "Hi Christopher! Monthly service reminder - would you like to schedule your detail?", timestamp: "2025-11-20T08:30:00Z" },
      { id: 2, from: "customer", text: "Yes! Next Tuesday would be great",  timestamp: "2025-11-20T08:40:00Z" },
      { id: 3, from: "business", text: "Tuesday at 2pm is available. Does that work?", timestamp: "2025-11-20T08:42:00Z" },
      { id: 4, from: "customer", text: "That works perfectly!", timestamp: "2025-11-20T08:45:00Z" },
    ],
  },
  {
    id: 9,
    customerId: 9,
    customerName: "Lisa Anderson",
    platform: "facebook",
    lastMessage: "Do you offer mobile service?",
    lastMessageAt: "2025-11-20T12:15:00Z",
    unreadCount: 1,
    messages: [
      { id: 1, from: "customer", text: "Hi! I'm interested in your services", timestamp: "2025-11-20T12:10:00Z" },
      { id: 2, from: "customer", text: "Do you offer mobile service?", timestamp: "2025-11-20T12:15:00Z" },
    ],
  },
  {
    id: 10,
    customerId: 10,
    customerName: "James Wilson",
    platform: "sms",
    lastMessage: "Absolutely! Same time next month?",
    lastMessageAt: "2025-11-20T15:30:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "business", text: "Hi James! Your Cayenne is ready for pickup. The detail came out fantastic!", timestamp: "2025-11-20T15:00:00Z" },
      { id: 2, from: "customer", text: "Excellent! I'll be there in 30 minutes", timestamp: "2025-11-20T15:15:00Z" },
      { id: 3, from: "business", text: "Would you like to schedule your next monthly detail?", timestamp: "2025-11-20T15:25:00Z" },
      { id: 4, from: "customer", text: "Absolutely! Same time next month?", timestamp: "2025-11-20T15:30:00Z" },
    ],
  },
  {
    id: 11,
    customerId: 11,
    customerName: "Maria Garcia",
    platform: "web",
    lastMessage: "Can I get a quote for full exterior and interior?",
    lastMessageAt: "2025-11-19T14:20:00Z",
    unreadCount: 1,
    messages: [
      { id: 1, from: "customer", text: "Hello! I'm new to the area", timestamp: "2025-11-19T14:15:00Z" },
      { id: 2, from: "customer", text: "Can I get a quote for full exterior and interior?", timestamp: "2025-11-19T14:20:00Z" },
    ],
  },
  {
    id: 12,
    customerId: 12,
    customerName: "Daniel Thompson",
    platform: "instagram",
    lastMessage: "Love your before/after posts!",
    lastMessageAt: "2025-11-18T20:10:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "customer", text: "Love your before/after posts!", timestamp: "2025-11-18T20:10:00Z" },
      { id: 2, from: "business", text: "Thank you! We'd love to detail your Volvo!", timestamp: "2025-11-18T20:25:00Z" },
    ],
  },
  {
    id: 13,
    customerId: 13,
    customerName: "Rachel Kim",
    platform: "sms",
    lastMessage: "Yes please! What time?",
    lastMessageAt: "2025-11-20T09:35:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "business", text: "Hi Rachel! We have an opening tomorrow if you'd like to schedule a detail", timestamp: "2025-11-20T09:30:00Z" },
      { id: 2, from: "customer", text: "Yes please! What time?", timestamp: "2025-11-20T09:35:00Z" },
    ],
  },
  {
    id: 14,
    customerId: 14,
    customerName: "Kevin Patel",
    platform: "web",
    lastMessage: "Perfect, I'll drop it off at 8am Friday",
    lastMessageAt: "2025-11-19T16:50:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "customer", text: "I need headlight restoration for my MDX", timestamp: "2025-11-19T16:30:00Z" },
      { id: 2, from: "business", text: "We can do that! Takes about 2 hours. Friday morning works?", timestamp: "2025-11-19T16:40:00Z" },
      { id: 3, from: "customer", text: "Perfect, I'll drop it off at 8am Friday", timestamp: "2025-11-19T16:50:00Z" },
    ],
  },
  {
    id: 15,
    customerId: 15,
    customerName: "Nicole Turner",
    platform: "facebook",
    lastMessage: "Can you remove dog hair from seats?",
    lastMessageAt: "2025-11-20T11:45:00Z",
    unreadCount: 1,
    messages: [
      { id: 1, from: "customer", text: "I have a Subaru that needs interior cleaning", timestamp: "2025-11-20T11:40:00Z" },
      { id: 2, from: "customer", text: "Can you remove dog hair from seats?", timestamp: "2025-11-20T11:45:00Z" },
    ],
  },
  {
    id: 16,
    customerId: 16,
    customerName: "Brandon Scott",
    platform: "sms",
    lastMessage: "See you then!",
    lastMessageAt: "2025-11-20T07:50:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "business", text: "Hi Brandon! Reminder: Your Tahoe detail is scheduled for today at 1pm", timestamp: "2025-11-20T07:00:00Z" },
      { id: 2, from: "customer", text: "Thanks for the reminder!", timestamp: "2025-11-20T07:45:00Z" },
      { id: 3, from: "customer", text: "See you then!", timestamp: "2025-11-20T07:50:00Z" },
    ],
  },
  {
    id: 17,
    customerId: 1,
    customerName: "Sarah Johnson",
    platform: "web",
    lastMessage: "How much is the ceramic coating?",
    lastMessageAt: "2025-11-15T13:20:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "customer", text: "I'm interested in ceramic coating for my Tesla", timestamp: "2025-11-15T13:15:00Z" },
      { id: 2, from: "customer", text: "How much is the ceramic coating?", timestamp: "2025-11-15T13:20:00Z" },
      { id: 3, from: "business", text: "For a Tesla Model 3, ceramic coating is $899. Includes full exterior detail and 2-year protection.", timestamp: "2025-11-15T13:30:00Z" },
    ],
  },
  {
    id: 18,
    customerId: 4,
    customerName: "David Martinez",
    platform: "sms",
    lastMessage: "You're the best!",
    lastMessageAt: "2025-11-17T18:00:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "business", text: "Hi David! Just finished your Mercedes. Want to add a complimentary tire shine?", timestamp: "2025-11-17T17:45:00Z" },
      { id: 2, from: "customer", text: "Yes please! Thank you!", timestamp: "2025-11-17T17:55:00Z" },
      { id: 3, from: "customer", text: "You're the best!", timestamp: "2025-11-17T18:00:00Z" },
    ],
  },
  {
    id: 19,
    customerId: 8,
    customerName: "Christopher Lee",
    platform: "instagram",
    lastMessage: "Sent you a DM!",
    lastMessageAt: "2025-11-16T21:30:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "customer", text: "Saw your story about the new wax treatment", timestamp: "2025-11-16T21:25:00Z" },
      { id: 2, from: "customer", text: "Sent you a DM!", timestamp: "2025-11-16T21:30:00Z" },
    ],
  },
  {
    id: 20,
    customerId: 10,
    customerName: "James Wilson",
    platform: "web",
    lastMessage: "Already booked for next month!",
    lastMessageAt: "2025-11-14T10:15:00Z",
    unreadCount: 0,
    messages: [
      { id: 1, from: "business", text: "Hi James! Your monthly detail reminder", timestamp: "2025-11-14T10:00:00Z" },
      { id: 2, from: "customer", text: "Already booked for next month!", timestamp: "2025-11-14T10:15:00Z" },
    ],
  },
];

// Mock Appointments (10+ with different statuses)
export const mockAppointments = [
  {
    id: 1,
    customerId: 1,
    customerName: "Sarah Johnson",
    service: "Full Detail",
    date: "2025-11-21",
    time: "14:00",
    status: "confirmed",
    price: 180.00,
    vehicle: "2022 Tesla Model 3",
    notes: "First-time customer referral from Michael Chen",
  },
  {
    id: 2,
    customerId: 4,
    customerName: "David Martinez",
    service: "Premium Detail + Ceramic Coating",
    date: "2025-11-21",
    time: "09:00",
    status: "in_progress",
    price: 899.00,
    vehicle: "2024 Mercedes GLE",
    notes: "VIP client - platinum tier",
  },
  {
    id: 3,
    customerId: 16,
    customerName: "Brandon Scott",
    service: "SUV Full Detail",
    date: "2025-11-21",
    time: "13:00",
    status: "confirmed",
    price: 225.00,
    vehicle: "2023 Chevrolet Tahoe",
    notes: "Monthly recurring service",
  },
  {
    id: 4,
    customerId: 10,
    customerName: "James Wilson",
    service: "Executive Detail Package",
    date: "2025-11-20",
    time: "10:00",
    status: "completed",
    price: 350.00,
    vehicle: "2024 Porsche Cayenne",
    notes: "Completed - customer very satisfied",
  },
  {
    id: 5,
    customerId: 7,
    customerName: "Amanda Brown",
    service: "Truck Detail + Engine Bay",
    date: "2025-11-18",
    time: "11:00",
    status: "completed",
    price: 245.00,
    vehicle: "2022 Ford F-150",
    notes: "Completed - excellent results",
  },
  {
    id: 6,
    customerId: 2,
    customerName: "Michael Chen",
    service: "Paint Correction",
    date: "2025-11-17",
    time: "08:00",
    status: "completed",
    price: 650.00,
    vehicle: "2023 BMW X5",
    notes: "Multi-stage correction - ceramic coating scheduled next week",
  },
  {
    id: 7,
    customerId: 8,
    customerName: "Christopher Lee",
    service: "Interior Shampoo + Exterior Wash",
    date: "2025-11-22",
    time: "15:00",
    status: "confirmed",
    price: 165.00,
    vehicle: "2023 Lexus RX",
    notes: "Regular monthly client",
  },
  {
    id: 8,
    customerId: 14,
    customerName: "Kevin Patel",
    service: "Headlight Restoration",
    date: "2025-11-22",
    time: "08:00",
    status: "confirmed",
    price: 120.00,
    vehicle: "2024 Acura MDX",
    notes: "Drop-off service",
  },
  {
    id: 9,
    customerId: 6,
    customerName: "Robert Williams",
    service: "Paint Correction + Ceramic Coating",
    date: "2025-11-22",
    time: "10:00",
    status: "confirmed",
    price: 1199.00,
    vehicle: "2023 Audi Q7",
    notes: "Premium package - estimated 6-8 hours",
  },
  {
    id: 10,
    customerId: 12,
    customerName: "Daniel Thompson",
    service: "Full Detail",
    date: "2025-11-16",
    time: "14:00",
    status: "completed",
    price: 195.00,
    vehicle: "2023 Volvo XC90",
    notes: "Completed - customer left 5-star review",
  },
  {
    id: 11,
    customerId: 3,
    customerName: "Emily Rodriguez",
    service: "Express Detail",
    date: "2025-11-12",
    time: "16:00",
    status: "completed",
    price: 95.00,
    vehicle: "2021 Honda CR-V",
    notes: "Quick turnaround service",
  },
  {
    id: 12,
    customerId: 11,
    customerName: "Maria Garcia",
    service: "Interior Detail",
    date: "2025-11-23",
    time: "11:00",
    status: "pending",
    price: 135.00,
    vehicle: "2022 Nissan Rogue",
    notes: "Awaiting customer confirmation",
  },
];

// Mock Analytics
export const mockAnalytics = {
  revenue: {
    today: 1425.00,
    week: 8950.00,
    month: 32400.00,
    year: 185000.00,
  },
  appointments: {
    today: 3,
    week: 24,
    month: 98,
    year: 1152,
  },
  conversionRate: {
    overall: 78.5,
    sms: 82.3,
    web: 76.1,
    facebook: 71.8,
    instagram: 69.4,
  },
  responseTime: {
    average: "2.4 minutes",
    sms: "1.8 minutes",
    web: "3.1 minutes",
    social: "4.2 minutes",
  },
  customerSatisfaction: {
    rating: 4.9,
    totalReviews: 487,
    fiveStarReviews: 456,
    repeatCustomerRate: 68.2,
  },
};

// Mock Services
export const mockServices = [
  {
    id: 1,
    name: "Express Detail",
    category: "Basic",
    price: 95.00,
    duration: "1-2 hours",
    description: "Quick exterior wash and interior vacuum",
  },
  {
    id: 2,
    name: "Full Detail",
    category: "Standard",
    price: 180.00,
    duration: "3-4 hours",
    description: "Complete interior and exterior detail",
  },
  {
    id: 3,
    name: "Premium Detail",
    category: "Premium",
    price: 275.00,
    duration: "4-6 hours",
    description: "Full detail plus wax and interior conditioning",
  },
  {
    id: 4,
    name: "Paint Correction",
    category: "Specialty",
    price: 650.00,
    duration: "6-8 hours",
    description: "Multi-stage paint correction and polish",
  },
  {
    id: 5,
    name: "Ceramic Coating",
    category: "Protection",
    price: 899.00,
    duration: "8-10 hours",
    description: "Professional ceramic coating with 2-year warranty",
  },
  {
    id: 6,
    name: "SUV Full Detail",
    category: "Standard",
    price: 225.00,
    duration: "4-5 hours",
    description: "Complete detail for SUVs and large vehicles",
  },
];

// Mock Loyalty Points & Referrals
export const mockLoyaltyTransactions = [
  { id: 1, customerId: 1, points: 180, type: "earned", reason: "Full Detail - $180.00", date: "2025-11-15" },
  { id: 2, customerId: 2, points: 899, type: "earned", reason: "Ceramic Coating - $899.00", date: "2025-11-18" },
  { id: 3, customerId: 4, points: -500, type: "redeemed", reason: "50% off coupon", date: "2025-11-19" },
  { id: 4, customerId: 10, points: 350, type: "earned", reason: "Executive Package - $350.00", date: "2025-11-20" },
  { id: 5, customerId: 1, points: 100, type: "bonus", reason: "Referral bonus - Sarah referred Emily", date: "2025-11-12" },
];

export const mockReferrals = [
  { id: 1, referrerId: 2, referredId: 1, referredName: "Sarah Johnson", status: "completed", reward: 50.00, date: "2025-11-10" },
  { id: 2, referrerId: 4, referredId: 11, referredName: "Maria Garcia", status: "completed", reward: 50.00, date: "2025-11-05" },
  { id: 3, referrerId: 10, referredId: 16, referredName: "Brandon Scott", status: "pending", reward: 0, date: "2025-11-18" },
];

// Mock Voicemails & Call Logs
export const mockVoicemails = [
  {
    id: 1,
    from: "+15550123456",
    fromName: "Sarah Johnson",
    duration: 32,
    timestamp: "2025-11-20T09:15:00Z",
    transcription: "Hi, this is Sarah. I'd like to schedule a detail for my Tesla tomorrow if possible. Please call me back. Thanks!",
    audioUrl: "/demo/voicemail-1.mp3",
  },
  {
    id: 2,
    from: "+15550234568",
    fromName: "Unknown",
    duration: 18,
    timestamp: "2025-11-19T14:30:00Z",
    transcription: "Hey, I saw your truck on the road. Looks great! What are your rates for a full-size truck? Call me back.",
    audioUrl: "/demo/voicemail-2.mp3",
  },
];

export const mockCallLogs = [
  { id: 1, customerId: 1, customerName: "Sarah Johnson", direction: "incoming", duration: 185, timestamp: "2025-11-20T14:10:00Z", status: "completed" },
  { id: 2, customerId: 4, customerName: "David Martinez", direction: "outgoing", duration: 92, timestamp: "2025-11-20T13:50:00Z", status: "completed" },
  { id: 3, customerId: null, customerName: "Unknown", direction: "incoming", duration: 0, timestamp: "2025-11-20T11:25:00Z", status: "missed" },
  { id: 4, customerId: 10, customerName: "James Wilson", direction: "incoming", duration: 245, timestamp: "2025-11-20T10:15:00Z", status: "completed" },
  { id: 5, customerId: 2, customerName: "Michael Chen", direction: "outgoing", duration: 156, timestamp: "2025-11-19T16:30:00Z", status: "completed" },
];

// Mock Technician Schedules
export const mockTechnicianSchedules = [
  {
    id: 1,
    technicianId: 1,
    technicianName: "Alex Thompson",
    date: "2025-11-21",
    shifts: [
      { id: 1, appointmentId: 2, time: "09:00-14:00", customer: "David Martinez", service: "Premium Detail" },
      { id: 2, appointmentId: 1, time: "14:00-18:00", customer: "Sarah Johnson", service: "Full Detail" },
    ],
  },
  {
    id: 2,
    technicianId: 2,
    technicianName: "Jordan Rivera",
    date: "2025-11-21",
    shifts: [
      { id: 3, appointmentId: 3, time: "13:00-18:00", customer: "Brandon Scott", service: "SUV Full Detail" },
    ],
  },
];

// Mock Payment History
export const mockPayments = [
  { id: 1, customerId: 10, amount: 350.00, method: "card", status: "completed", date: "2025-11-20", invoice: "INV-001234" },
  { id: 2, customerId: 7, amount: 245.00, method: "cash", status: "completed", date: "2025-11-18", invoice: "INV-001233" },
  { id: 3, customerId: 2, amount: 650.00, method: "card", status: "completed", date: "2025-11-17", invoice: "INV-001232" },
  { id: 4, customerId: 12, amount: 195.00, method: "card", status: "completed", date: "2025-11-16", invoice: "INV-001231" },
  { id: 5, customerId: 1, amount: 180.00, method: "pending", status: "pending", date: "2025-11-21", invoice: "INV-001235" },
];

// Mock Dashboard Summary
export const mockDashboardSummary = {
  todayAppointments: 3,
  weekRevenue: 8950.00,
  monthRevenue: 32400.00,
  pendingMessages: 5,
  activeCustomers: 156,
  averageRating: 4.9,
  completionRate: 98.5,
};

// Helper function to get mock data by type
export function getMockData(type: string, params?: any) {
  switch (type) {
    case 'customers':
      return mockCustomers;
    case 'customer':
      return mockCustomers.find(c => c.id === params?.id);
    case 'conversations':
      return mockConversations;
    case 'conversation':
      return mockConversations.find(c => c.id === params?.id);
    case 'appointments':
      return mockAppointments;
    case 'appointment':
      return mockAppointments.find(a => a.id === params?.id);
    case 'analytics':
      return mockAnalytics;
    case 'services':
      return mockServices;
    case 'loyalty':
      return mockLoyaltyTransactions;
    case 'referrals':
      return mockReferrals;
    case 'voicemails':
      return mockVoicemails;
    case 'callLogs':
      return mockCallLogs;
    case 'technicianSchedules':
      return mockTechnicianSchedules;
    case 'payments':
      return mockPayments;
    case 'dashboard':
      return mockDashboardSummary;
    default:
      return null;
  }
}
