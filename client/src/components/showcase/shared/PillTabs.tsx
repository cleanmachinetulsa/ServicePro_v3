import { motion } from 'framer-motion';

interface PillTab {
  id: string;
  label: string;
  badge?: {
    text: string;
    color: string;
  };
}

interface PillTabsProps {
  tabs: PillTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function PillTabs({ tabs, activeTab, onChange, className = '' }: PillTabsProps) {
  return (
    <div className={`flex flex-wrap gap-2 justify-center ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="relative px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 group"
          data-testid={`tab-${tab.id}`}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"
              transition={{ type: 'spring', duration: 0.5 }}
            />
          )}
          <span className={`relative z-10 flex items-center gap-2 ${
            activeTab === tab.id 
              ? 'text-white' 
              : 'text-blue-300 hover:text-white'
          }`}>
            {tab.label}
            {tab.badge && (
              <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase bg-gradient-to-r ${tab.badge.color} rounded-full text-white shadow-lg`}>
                {tab.badge.text}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
