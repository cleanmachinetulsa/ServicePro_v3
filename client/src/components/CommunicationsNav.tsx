import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { MessageCircle, Phone, Settings, ArrowLeft } from 'lucide-react';

interface CommunicationsNavProps {
  showBackButton?: boolean;
  backUrl?: string;
  backLabel?: string;
}

export default function CommunicationsNav({ 
  showBackButton = false, 
  backUrl = '/messages',
  backLabel = 'Back'
}: CommunicationsNavProps) {
  const [location, setLocation] = useLocation();
  
  // Parse pathname to handle query parameters (e.g., /messages?new=5551234567)
  const pathname = location.split('?')[0];
  const isMessages = pathname === '/messages' || pathname.startsWith('/messages/');
  const isPhone = pathname === '/phone' || pathname.startsWith('/phone/');

  return (
    <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Back button or Logo */}
        <div className="flex items-center gap-4">
          {showBackButton ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(backUrl)}
              className="gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-lg">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold dark:text-white">Communications Hub</h1>
            </div>
          )}
        </div>

        {/* Right: Main navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant={isMessages ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLocation('/messages')}
            className="gap-2"
            data-testid="nav-messages"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Messages</span>
          </Button>
          
          <Button
            variant={isPhone ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLocation('/phone')}
            className="gap-2"
            data-testid="nav-phone"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Phone</span>
          </Button>

          {isMessages && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/notifications-settings')}
              className="gap-2"
              data-testid="nav-settings"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
