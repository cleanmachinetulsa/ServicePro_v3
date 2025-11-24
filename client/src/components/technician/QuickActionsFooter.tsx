import { Button } from '@/components/ui/button';
import { Phone, MapPin, Camera, ArrowRight, CalendarPlus } from 'lucide-react';

interface QuickActionsFooterProps {
  onMarkOnSite: () => void;
  onEmergencyCall: () => void;
  onQuickPhoto: () => void;
  onNextJob: () => void;
  onQuickBooking: () => void;
  disabled?: boolean;
}

export function QuickActionsFooter({
  onMarkOnSite,
  onEmergencyCall,
  onQuickPhoto,
  onNextJob,
  onQuickBooking,
  disabled = false,
}: QuickActionsFooterProps) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-[60px] bg-blue-950/95 backdrop-blur-lg border-t border-blue-800 z-50">
      <div className="h-full px-2 md:px-4 flex items-center justify-center gap-1.5 md:gap-2">
        <Button
          size="lg"
          onClick={onQuickBooking}
          className="flex-1 max-w-[170px] h-12 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
          data-testid="button-quick-booking"
        >
          <CalendarPlus className="w-5 h-5 mr-1.5" />
          <span className="hidden sm:inline">Quick</span> Book
        </Button>

        <Button
          size="lg"
          onClick={onMarkOnSite}
          disabled={disabled}
          className="flex-1 max-w-[170px] h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          data-testid="button-quick-on-site"
        >
          <MapPin className="w-5 h-5 mr-1.5" />
          <span className="hidden sm:inline">Mark</span> On-Site
        </Button>

        <Button
          size="lg"
          onClick={onEmergencyCall}
          className="flex-1 max-w-[170px] h-12 bg-red-600 hover:bg-red-700 text-white font-semibold"
          data-testid="button-emergency-call"
        >
          <Phone className="w-5 h-5 mr-1.5" />
          <span className="hidden sm:inline">Emergency</span> Call
        </Button>

        <Button
          size="lg"
          onClick={onQuickPhoto}
          disabled={disabled}
          className="flex-1 max-w-[170px] h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
          data-testid="button-quick-photo"
        >
          <Camera className="w-5 h-5 mr-1.5" />
          <span className="hidden sm:inline">Quick</span> Photo
        </Button>

        <Button
          size="lg"
          onClick={onNextJob}
          disabled={disabled}
          className="flex-1 max-w-[170px] h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          data-testid="button-next-job"
        >
          <span className="hidden sm:inline">Next</span> Job
          <ArrowRight className="w-5 h-5 ml-1.5" />
        </Button>
      </div>
    </footer>
  );
}
