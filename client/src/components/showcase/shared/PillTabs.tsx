import { motion } from 'framer-motion';

interface PillTab {
  id: string;
  label: string;
  accentColor?: string;
}

interface PillTabsProps {
  tabs: PillTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function PillTabs({ tabs, activeTab, onChange, className = '' }: PillTabsProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 sm:gap-2 justify-center ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const hasAccent = !!tab.accentColor;
        
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 group touch-manipulation ${
              hasAccent && !isActive
                ? `bg-gradient-to-r ${tab.accentColor} text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95`
                : !isActive
                ? 'bg-white/5 text-blue-300 hover:bg-white/10 hover:text-white active:bg-white/15'
                : ''
            }`}
            data-testid={`tab-${tab.id}`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-2xl"
                transition={{ type: 'spring', duration: 0.5 }}
              />
            )}
            <span className={`relative z-10 whitespace-nowrap ${isActive ? 'text-white' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
