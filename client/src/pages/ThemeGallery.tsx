import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/AppShell';
import { useToast } from '@/hooks/use-toast';
import { Check, Palette, Sparkles } from 'lucide-react';
import { dashboardThemes, DashboardTheme } from '@shared/themes';

export default function ThemeGallery() {
  const { toast } = useToast();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [currentThemeId, setCurrentThemeId] = useState<string>('modern-dark');
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard-theme');
    if (saved) {
      setCurrentThemeId(saved);
      const theme = dashboardThemes.find(t => t.id === saved);
      if (theme) {
        applyThemeToDOM(theme);
      }
    }
  }, []);

  const applyThemeToDOM = (theme: DashboardTheme) => {
    const root = document.documentElement;
    Object.entries(theme.cssVariables).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  };

  const handleSelectTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    const theme = dashboardThemes.find(t => t.id === themeId);
    if (theme) {
      applyThemeToDOM(theme);
    }
  };

  const handleApplyTheme = () => {
    if (selectedTheme) {
      setIsApplying(true);
      const theme = dashboardThemes.find(t => t.id === selectedTheme);
      if (theme) {
        localStorage.setItem('dashboard-theme', selectedTheme);
        setCurrentThemeId(selectedTheme);
        applyThemeToDOM(theme);
        toast({
          title: 'Theme Applied',
          description: `Your dashboard is now using the ${theme.name} theme.`,
        });
        setSelectedTheme(null);
      }
      setIsApplying(false);
    }
  };

  const activeTheme = selectedTheme || currentThemeId;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Theme Gallery
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Choose from a collection of beautifully designed themes to personalize your dashboard
            </p>
          </div>
          {selectedTheme && selectedTheme !== currentThemeId && (
            <Button
              onClick={handleApplyTheme}
              disabled={isApplying}
              size="lg"
              className="gap-2"
              data-testid="button-apply-theme"
            >
              {isApplying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Applying...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Apply Theme
                </>
              )}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardThemes.map((theme: DashboardTheme) => (
            <Card
              key={theme.id}
              className={`
                relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl
                ${activeTheme === theme.id ? 'ring-2 ring-primary ring-offset-2' : ''}
              `}
              onClick={() => handleSelectTheme(theme.id)}
              data-testid={`theme-card-${theme.id}`}
            >
              {activeTheme === theme.id && (
                <div className="absolute top-4 right-4 z-10 bg-primary text-primary-foreground rounded-full p-2">
                  <Check className="w-5 h-5" />
                </div>
              )}

              <div className="h-48 p-6 relative" style={{ backgroundColor: theme.preview.background }}>
                <div className="space-y-4">
                  <div
                    className="h-8 rounded-lg"
                    style={{
                      backgroundColor: theme.preview.primary,
                      boxShadow: `0 4px 12px ${theme.preview.primary}40`,
                    }}
                  ></div>
                  <div className="flex gap-3">
                    <div
                      className="h-6 w-1/3 rounded"
                      style={{ backgroundColor: theme.preview.secondary }}
                    ></div>
                    <div
                      className="h-6 w-1/2 rounded"
                      style={{ backgroundColor: theme.preview.accent }}
                    ></div>
                  </div>
                  <div
                    className="h-16 rounded-lg p-4 flex items-center gap-3"
                    style={{ backgroundColor: theme.preview.surface }}
                  >
                    <div
                      className="w-10 h-10 rounded-full"
                      style={{ backgroundColor: theme.preview.primary }}
                    ></div>
                    <div className="flex-1 space-y-2">
                      <div
                        className="h-2 w-3/4 rounded"
                        style={{ backgroundColor: theme.preview.text, opacity: 0.7 }}
                      ></div>
                      <div
                        className="h-2 w-1/2 rounded"
                        style={{ backgroundColor: theme.preview.text, opacity: 0.5 }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {theme.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {theme.description}
                </p>
                <div className="flex gap-2 mt-4">
                  {Object.entries(theme.preview).slice(0, 4).map(([name, color]) => (
                    <div
                      key={name}
                      className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={name}
                    ></div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {currentThemeId && (
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Palette className="w-6 h-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Current Theme
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You're currently using the{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {dashboardThemes.find(t => t.id === currentThemeId)?.name}
                  </span>{' '}
                  theme. Select a different theme above to preview it, then click "Apply Theme" to save your choice.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
