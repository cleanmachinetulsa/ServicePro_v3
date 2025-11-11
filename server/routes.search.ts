import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function registerSearchRoutes(app: Router) {
  app.post('/api/search/help', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.json({ success: true, results: [] });
      }

      // Define available features with paths
      const features = [
        { name: 'Dashboard', path: '/dashboard', keywords: 'overview, stats, analytics, home, main', description: 'Main dashboard with business overview' },
        { name: 'Chat Monitor', path: '/monitor', keywords: 'conversations, chat, live, messages, monitor, customer service', description: 'Monitor live customer conversations in real-time' },
        { name: 'Messages', path: '/messages', keywords: 'inbox, sms, text, messages, chat history', description: 'Unified message inbox for SMS and web chat' },
        { name: 'Schedule', path: '/schedule', keywords: 'calendar, appointments, booking, schedule', description: 'View and manage appointments' },
        { name: 'Customer Database', path: '/customer-database', keywords: 'customers, contacts, database, crm', description: 'Manage customer information and history' },
        { name: 'Reviews', path: '/reviews', keywords: 'reviews, feedback, ratings, testimonials', description: 'Customer reviews and ratings' },
        { name: 'Gallery', path: '/gallery', keywords: 'photos, gallery, pictures, images', description: 'Photo gallery of completed work' },
        { name: 'Loyalty & Rewards', path: '/rewards', keywords: 'loyalty, points, rewards, gamification', description: 'Loyalty program and customer rewards' },
        { name: 'Settings', path: '/settings', keywords: 'settings, configuration, preferences, templates, notifications, security, password', description: 'App settings, templates, and security' },
        { name: 'Business Settings', path: '/business-settings', keywords: 'business, company, info, settings, configuration', description: 'Business information and configuration' },
        { name: 'Service History', path: '/service-history', keywords: 'history, past services, records', description: 'Customer service history' },
        { name: 'Login', path: '/login', keywords: 'login, sign in, authentication, password', description: 'Login to your account' },
      ];

      // Use GPT to match query to features
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a search assistant for a business communications app. Based on user queries, suggest relevant app features.

Available features:
${features.map(f => `- ${f.name} (${f.path}): ${f.description}. Keywords: ${f.keywords}`).join('\n')}

Return up to 5 most relevant features as a JSON array of feature names only. Be smart about synonyms and user intent.
Examples:
- "how do I see my messages" → ["Messages", "Chat Monitor"]
- "customer info" → ["Customer Database", "Service History"]
- "change my password" → ["Settings", "Login"]
- "appointments" → ["Schedule"]

Return ONLY valid JSON array of feature names, no other text.`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      });

      const aiResponse = completion.choices[0]?.message?.content || '[]';
      
      // Parse AI response
      let suggestedFeatureNames: string[] = [];
      try {
        suggestedFeatureNames = JSON.parse(aiResponse);
      } catch (e) {
        console.error('Failed to parse AI response:', aiResponse);
        suggestedFeatureNames = [];
      }

      // Map feature names to full feature objects
      const results = suggestedFeatureNames
        .map(name => features.find(f => f.name === name))
        .filter(Boolean)
        .slice(0, 5);

      res.json({
        success: true,
        results: results.map(r => ({
          name: r!.name,
          path: r!.path,
          description: r!.description,
        })),
      });
    } catch (error) {
      console.error('Help search error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
      });
    }
  });
}
