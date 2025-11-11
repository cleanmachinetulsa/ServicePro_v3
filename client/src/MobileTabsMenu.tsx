import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  CalendarClock, 
  MessageSquare,
  Car,
  Star,
  Settings,
  CloudRain,
  ChevronDown
} from 'lucide-react';

type Tab = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

interface MobileTabsMenuProps {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
}

const MobileTabsMenu: React.FC<MobileTabsMenuProps> = ({ activeTab, setActiveTab }) => {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const tabs: Tab[] = [
    { id: 'today', label: "Today's Appointments", icon: <CalendarClock className="h-4 w-4" /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'services', label: 'Services', icon: <Car className="h-4 w-4" /> },
    { id: 'reviews', label: 'Reviews', icon: <Star className="h-4 w-4" /> },
    { id: 'formatter', label: 'Formatter', icon: <Settings className="h-4 w-4" /> },
    { id: 'weather', label: 'Weather', icon: <CloudRain className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> }
  ];
  
  const activeTabInfo = tabs.find(tab => tab.id === activeTab) || tabs[0];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsOpen(false);
  };
  
  return (
    <div className="relative w-full flex flex-col mb-4">
      {/* Current tab display/dropdown button */}
      <button 
        className="flex items-center justify-between w-full p-3 bg-blue-600 text-white rounded-lg shadow"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          {activeTabInfo.icon}
          <span className="ml-2 font-medium">{activeTabInfo.label}</span>
        </div>
        <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center w-full p-3 text-left hover:bg-blue-50 ${
                tab.id === activeTab ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
              }`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </button>
          ))}
          <button
            className="flex items-center w-full p-3 text-left hover:bg-blue-50 text-gray-700 border-t border-gray-100"
            onClick={() => {
              setLocation('/live-conversations');
              setIsOpen(false);
            }}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="ml-2">Live Chat</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileTabsMenu;