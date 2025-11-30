import { ReactNode } from 'react';
import logoImage from '@assets/generated_images/Clean_Machine_white_logo_transparent_f0645d6c.png';
import { Settings, LayoutDashboard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link } from 'wouter';

interface TechnicianLayoutProps {
  children: ReactNode;
  technicianName?: string;
  technicianStatus?: 'available' | 'on_job' | 'break';
  shiftStart?: string;
  jobsCompleted?: number;
  totalJobs?: number;
  demoMode?: boolean;
  onToggleDemo?: (enabled: boolean) => void;
}

export function TechnicianLayout({
  children,
  technicianName = 'Technician',
  technicianStatus = 'available',
  shiftStart,
  jobsCompleted = 0,
  totalJobs = 0,
  demoMode = false,
  onToggleDemo,
}: TechnicianLayoutProps) {
  const statusColors = {
    available: 'bg-green-500',
    on_job: 'bg-blue-500',
    break: 'bg-orange-500',
  };

  const statusLabels = {
    available: 'Available',
    on_job: 'On Job',
    break: 'On Break',
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      {/* Header - Sticky */}
      <header className="flex-shrink-0 bg-blue-950 border-b border-blue-800 px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Branding */}
          <div className="flex items-center gap-3 md:gap-4">
            <img
              src={logoImage}
              alt="Logo"
              className="h-16 w-16 md:h-20 md:w-20 object-cover drop-shadow-lg mix-blend-screen scale-125"
              style={{ filter: 'brightness(1.1)' }}
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-bold text-white">
                  TECHNICIAN MODE
                </h1>
                {demoMode && (
                  <Badge 
                    variant="secondary" 
                    className="bg-yellow-500/20 text-yellow-300 border-yellow-500 hidden md:inline-flex"
                    data-testid="badge-demo-mode"
                  >
                    DEMO MODE
                  </Badge>
                )}
              </div>
              <p className="text-xs md:text-sm text-blue-200">
                {technicianName}
              </p>
            </div>
          </div>

          {/* Right: Status + Shift Info */}
          <div className="flex items-center gap-3 md:gap-4">
            {shiftStart && (
              <div className="hidden md:block text-right">
                <p className="text-xs text-blue-300">Shift Started</p>
                <p className="text-sm font-semibold text-white">{shiftStart}</p>
              </div>
            )}
            
            {totalJobs > 0 && (
              <div className="hidden lg:block text-right">
                <p className="text-xs text-blue-300">Jobs Today</p>
                <p className="text-sm font-semibold text-white">
                  {jobsCompleted}/{totalJobs}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
              <div className={`w-2.5 h-2.5 rounded-full ${statusColors[technicianStatus]} animate-pulse`} />
              <span className="text-sm font-medium text-white">
                {statusLabels[technicianStatus]}
              </span>
            </div>

            {/* Dashboard Navigation Button */}
            <Link href="/dashboard">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10"
                data-testid="button-go-to-dashboard"
              >
                <LayoutDashboard className="h-5 w-5" />
              </Button>
            </Link>

            {/* Settings Popover with Demo Mode Toggle */}
            {onToggleDemo && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/10"
                    data-testid="button-settings"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" data-testid="popover-settings">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Settings</h3>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium" htmlFor="demo-mode-switch">
                          Demo Mode
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Show sample jobs
                        </p>
                      </div>
                      <Switch 
                        id="demo-mode-switch"
                        checked={demoMode} 
                        onCheckedChange={onToggleDemo}
                        data-testid="switch-demo-mode"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                      Enable to test with sample data without affecting real jobs or making API calls
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Now scrollable */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
