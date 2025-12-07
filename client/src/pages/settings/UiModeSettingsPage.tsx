import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUiExperienceMode, UiExperienceMode } from '@/hooks/useUiExperienceMode';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Sparkles, Settings2, Loader2 } from 'lucide-react';

export default function UiModeSettingsPage() {
  const { mode, isLoading, isSaving, saveMode } = useUiExperienceMode();
  const [localMode, setLocalMode] = useState<UiExperienceMode>('simple');
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading) {
      setLocalMode(mode);
    }
  }, [mode, isLoading]);

  const handleSave = async () => {
    try {
      await saveMode(localMode);
      toast({
        title: 'Interface mode updated',
        description: `You're now using ${localMode === 'simple' ? 'Simple' : 'Advanced'} mode.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update interface mode. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const hasChanges = localMode !== mode;

  if (isLoading) {
    return (
      <AppShell title="Interface Mode">
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Interface Mode">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-ui-mode-title">
            Interface Mode
          </h2>
          <p className="text-muted-foreground mt-1">
            Choose how much detail you want to see in your dashboard.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            className={`cursor-pointer transition-all ${
              localMode === 'simple'
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'hover:border-gray-400'
            }`}
            onClick={() => setLocalMode('simple')}
            data-testid="card-simple-mode"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                {localMode === 'simple' && (
                  <div className="p-1 bg-blue-500 rounded-full">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <CardTitle className="mt-3">Simple Mode</CardTitle>
              <CardDescription className="text-xs font-medium text-green-600 dark:text-green-400">
                Recommended
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Best for busy owners. Hides advanced telephony, A2P compliance, and developer tools. 
                You still get full power, but with a cleaner, friendlier layout.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Clean, focused dashboard
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Essential tools only
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Less overwhelming
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              localMode === 'advanced'
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'hover:border-gray-400'
            }`}
            onClick={() => setLocalMode('advanced')}
            data-testid="card-advanced-mode"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                  <Settings2 className="h-5 w-5 text-white" />
                </div>
                {localMode === 'advanced' && (
                  <div className="p-1 bg-blue-500 rounded-full">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <CardTitle className="mt-3">Advanced Mode</CardTitle>
              <CardDescription className="text-xs font-medium text-purple-600 dark:text-purple-400">
                Power users & agencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Shows every setting and control, including detailed SMS compliance, IVR trees, 
                and power-user tools. Great for technical users and agencies.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  Full control panel access
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  SMS compliance tools
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  Developer & API settings
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {hasChanges
              ? 'You have unsaved changes.'
              : `Currently using ${mode === 'simple' ? 'Simple' : 'Advanced'} mode.`}
          </p>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            data-testid="button-save-ui-mode"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
