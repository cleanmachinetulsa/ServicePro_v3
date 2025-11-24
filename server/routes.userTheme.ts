import { Router } from 'express';
import { requireAuth } from './authMiddleware';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { dashboardThemes } from '../shared/themes';
import { z } from 'zod';

export const userThemeRouter = Router();

const updateThemeSchema = z.object({
  themeId: z.string().refine(
    (id) => dashboardThemes.some(theme => theme.id === id),
    { message: 'Invalid theme ID' }
  ),
});

userThemeRouter.get('/api/user/theme', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const themeId = user.dashboardTheme || 'modern-dark';
    const theme = dashboardThemes.find(t => t.id === themeId) || dashboardThemes[0];

    res.json({
      currentTheme: themeId,
      theme,
    });
  } catch (error) {
    console.error('Error fetching user theme:', error);
    res.status(500).json({ error: 'Failed to fetch theme' });
  }
});

userThemeRouter.put('/api/user/theme', requireAuth, async (req, res) => {
  try {
    const validation = updateThemeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid theme data',
        details: validation.error.flatten(),
      });
    }

    const { themeId } = validation.data;
    const userId = req.session.userId;

    await db
      .update(users)
      .set({ dashboardTheme: themeId })
      .where(eq(users.id, userId));

    const theme = dashboardThemes.find(t => t.id === themeId);

    res.json({
      success: true,
      themeId,
      theme,
    });
  } catch (error) {
    console.error('Error updating user theme:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

userThemeRouter.get('/api/themes', async (req, res) => {
  res.json({
    themes: dashboardThemes,
  });
});
