import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check, Loader2 } from 'lucide-react';
import { setLanguage, supportedLanguages } from '@/i18n';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface LanguageSwitcherProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function LanguageSwitcher({ 
  variant = 'ghost', 
  size = 'sm',
  showLabel = true 
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation('common');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = supportedLanguages.find(l => l.code === i18n.language) || supportedLanguages[0];

  const updateLanguageMutation = useMutation({
    mutationFn: async (language: string) => {
      return apiRequest('PUT', '/api/settings/user-language', { language });
    },
    onSuccess: (_, language) => {
      setLanguage(language);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/context'] });
      toast({
        title: t('settings.changesSaved'),
        description: language === 'es' ? 'Idioma actualizado a Español' : 'Language updated to English',
      });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        variant: 'destructive',
      });
    },
  });

  const handleLanguageChange = (langCode: string) => {
    if (langCode !== i18n.language) {
      updateLanguageMutation.mutate(langCode);
    }
    setIsOpen(false);
  };

  const getFlagEmoji = (code: string) => {
    return code === 'es' ? '🇲🇽' : '🇺🇸';
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className="gap-1.5"
          data-testid="button-language-switcher"
          disabled={updateLanguageMutation.isPending}
        >
          {updateLanguageMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Globe className="h-4 w-4" />
              {showLabel && (
                <span className="hidden sm:inline">
                  {getFlagEmoji(currentLang.code)} {currentLang.code.toUpperCase()}
                </span>
              )}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className="flex items-center justify-between cursor-pointer"
            data-testid={`menu-item-lang-${lang.code}`}
          >
            <span className="flex items-center gap-2">
              <span>{getFlagEmoji(lang.code)}</span>
              <span>{lang.nativeName}</span>
            </span>
            {i18n.language === lang.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
