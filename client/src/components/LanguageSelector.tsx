import { useTranslation } from 'react-i18next';
import { supportedLanguages, setLanguage } from '@/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface LanguageSelectorProps {
  showLabel?: boolean;
  persistToServer?: boolean;
  className?: string;
}

export function LanguageSelector({ showLabel = true, persistToServer = true, className }: LanguageSelectorProps) {
  const { i18n, t } = useTranslation('common');
  const { toast } = useToast();

  const updateLanguageMutation = useMutation({
    mutationFn: async (language: string) => {
      if (persistToServer) {
        await apiRequest('PUT', '/api/user/language', { language });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/context'] });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        variant: 'destructive',
      });
    },
  });

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    if (persistToServer) {
      updateLanguageMutation.mutate(lang);
    }
  };

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('settings.language')}</span>
        </div>
      )}
      <Select value={i18n.language} onValueChange={handleLanguageChange}>
        <SelectTrigger data-testid="select-language" className="w-[180px]">
          <SelectValue placeholder={t('common.select')} />
        </SelectTrigger>
        <SelectContent>
          {supportedLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} data-testid={`language-option-${lang.code}`}>
              {lang.nativeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showLabel && (
        <p className="text-xs text-muted-foreground mt-1">
          {t('settings.languageDescription')}
        </p>
      )}
    </div>
  );
}
