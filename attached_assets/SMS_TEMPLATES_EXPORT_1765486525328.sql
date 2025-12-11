-- CLEAN MACHINE SMS TEMPLATES EXPORT
-- Run this in your NEW SERVICEPRO workspace after changing tenant_id

INSERT INTO sms_templates (template_key, category, channel, name, body, variables, enabled, tenant_id) VALUES

-- BOOKING TEMPLATES
('booking_confirmation', 'booking', 'sms', 'Booking Confirmation', 
'Thanks {firstName}! Your {serviceName} appointment is confirmed for {date} at {time}. We''ll send you a reminder 24 hours before.

View your services: https://cleanmachinetulsa.com/my-services

Reply STOP to opt out.',
'[{"name": "firstName", "sample": "Alex", "required": true, "description": "Customer''s first name"}, {"name": "serviceName", "sample": "Full Detail", "required": true, "description": "Service booked"}, {"name": "date", "sample": "Dec 15", "required": true, "description": "Appointment date"}, {"name": "time", "sample": "2:00 PM", "required": true, "description": "Appointment time"}]',
true, 'servicepro-clean-machine'),

('appointment_reminder_24h', 'booking', 'sms', '24-Hour Appointment Reminder',
'Hi {firstName}! This is a reminder that your {serviceName} appointment is tomorrow at {time}. Looking forward to making your vehicle shine! ✨',
'[{"name": "firstName", "sample": "Mike", "required": true, "description": "Customer''s first name"}, {"name": "serviceName", "sample": "Interior Detail", "required": true, "description": "Service booked"}, {"name": "time", "sample": "10:00 AM", "required": true, "description": "Appointment time"}]',
true, 'servicepro-clean-machine'),

('appointment_reminder_1h', 'booking', 'sms', '1-Hour Appointment Reminder',
'Hey {firstName}! Your {serviceName} appointment is in 1 hour. Our technician {technicianName} will arrive at {time}. See you soon! 🚗',
'[{"name": "firstName", "sample": "Lisa", "required": true, "description": "Customer''s first name"}, {"name": "serviceName", "sample": "Full Detail", "required": true, "description": "Service booked"}, {"name": "technicianName", "sample": "James", "required": false, "description": "Assigned technician"}, {"name": "time", "sample": "3:00 PM", "required": true, "description": "Appointment time"}]',
true, 'servicepro-clean-machine'),

-- TECHNICIAN TEMPLATES
('on_site_arrival', 'technician', 'sms', 'Technician On-Site Arrival',
'Hey {firstName}! 👋 Your Clean Machine technician has arrived and will be with you shortly. Get ready for that showroom shine! ✨',
'[{"name": "firstName", "sample": "John", "required": true, "description": "Customer''s first name"}]',
true, 'servicepro-clean-machine'),

('damage_assessment_request', 'technician', 'sms', 'Damage Assessment Photo Request',
'Hi {firstName}! To give you an accurate quote for the damage you mentioned, could you text us a few photos? This helps us prepare the right materials. Thanks!',
'[{"name": "firstName", "sample": "David", "required": true, "description": "Customer''s first name"}]',
true, 'servicepro-clean-machine'),

('missed_call_auto_response', 'technician', 'sms', 'Missed Call Auto-Response',
'Hi! Sorry we missed your call. Book online at cleanmachinetulsa.com or reply with your service needs and we''ll get back to you ASAP! 🚗✨',
'[]',
true, 'servicepro-clean-machine'),

-- QUOTE TEMPLATE
('specialty_quote_received', 'booking', 'sms', 'Specialty Quote Request Received',
'Thanks {firstName}! We''ve received your specialty service request. We''ll review it and get back to you within 2-4 hours with a custom quote. Talk soon!',
'[{"name": "firstName", "sample": "Jessica", "required": true, "description": "Customer''s first name"}]',
true, 'servicepro-clean-machine'),

-- PAYMENT TEMPLATE
('payment_received', 'payment', 'sms', 'Payment Received Confirmation',
'Payment received, {firstName}! Thanks for choosing Clean Machine. Your {serviceName} is all set for {date}. We can''t wait to make your ride shine! 🎉',
'[{"name": "firstName", "sample": "Tom", "required": true, "description": "Customer''s first name"}, {"name": "serviceName", "sample": "Ceramic Coating", "required": true, "description": "Service booked"}, {"name": "date", "sample": "Dec 20", "required": true, "description": "Appointment date"}]',
true, 'servicepro-clean-machine');

-- ============================================
-- IMPORTANT INSTRUCTIONS:
-- ============================================
-- 1. Change 'servicepro-clean-machine' to your actual SERVICEPRO tenant_id
-- 2. Change 'cleanmachinetulsa.com' URLs to your domain
-- 3. Paste this entire block into your SERVICEPRO database
-- 4. Verify with: SELECT template_key, name FROM sms_templates WHERE tenant_id = 'servicepro-clean-machine';
-- 5. You should see 8 templates returned
