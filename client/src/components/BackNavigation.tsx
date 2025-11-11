import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

interface BackNavigationProps {
  fallbackPath?: string;
  label?: string;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
}

export default function BackNavigation({ 
  fallbackPath = '/dashboard', 
  label = 'Back',
  className = '',
  variant = 'ghost'
}: BackNavigationProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    // Prefer browser history, fallback to SPA routing
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      setLocation(fallbackPath);
    }
  };

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleBack}
      className={className}
      data-testid="button-back-navigation"
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}
