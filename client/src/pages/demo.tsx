import { DemoModeProvider } from '@/contexts/DemoModeContext';
import Dashboard from './dashboard';

export default function DemoPage() {
  return (
    <DemoModeProvider>
      {/* Demo mode banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4 text-center text-sm font-medium shadow-lg">
        🎭 DEMO MODE - Exploring Acme Detailing (Mock Data) - Changes will not be saved
      </div>
      
      {/* Main app with top padding to account for banner */}
      <div className="pt-12">
        <Dashboard />
      </div>
    </DemoModeProvider>
  );
}