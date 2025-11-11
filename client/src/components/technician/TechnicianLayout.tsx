import { ReactNode } from 'react';
import logoImage from '@assets/generated_images/Clean_Machine_white_logo_transparent_f0645d6c.png';

interface TechnicianLayoutProps {
  children: ReactNode;
  technicianName?: string;
  technicianStatus?: 'available' | 'on_job' | 'break';
  shiftStart?: string;
  jobsCompleted?: number;
  totalJobs?: number;
}

export function TechnicianLayout({
  children,
  technicianName = 'Technician',
  technicianStatus = 'available',
  shiftStart,
  jobsCompleted = 0,
  totalJobs = 0,
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 overflow-hidden">
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
              <h1 className="text-xl md:text-2xl font-bold text-white">
                TECHNICIAN MODE
              </h1>
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
