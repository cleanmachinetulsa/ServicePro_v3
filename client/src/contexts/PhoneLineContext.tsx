import { createContext, useContext, useState, ReactNode } from 'react';

interface PhoneLineContextType {
  // FILTER: Which conversations to display (null = "All Lines", number = specific line)
  conversationFilter: number | null;
  setConversationFilter: (id: number | null) => void;
  
  // SENDER: Which line to send messages from (ALWAYS has a value, never null)
  activeSendLineId: number;
  setActiveSendLineId: (id: number) => void;
  
  // Legacy support - maps to activeSendLineId
  selectedPhoneLineId: number;
  setSelectedPhoneLineId: (id: number) => void;
}

const PhoneLineContext = createContext<PhoneLineContextType | undefined>(undefined);

export function PhoneLineProvider({ children }: { children: ReactNode }) {
  // FILTER: Which conversations to show (null = all, number = specific line)
  const [conversationFilter, setConversationFilterState] = useState<number | null>(() => {
    const saved = localStorage.getItem('conversationFilter');
    return saved ? (saved === 'null' ? null : parseInt(saved)) : null; // Default to "All Lines"
  });

  // SENDER: Which line to send from (ALWAYS has value - defaults to Line 2 since Line 1 is broken)
  const [activeSendLineId, setActiveSendLineIdState] = useState<number>(() => {
    const saved = localStorage.getItem('activeSendLineId');
    return saved ? parseInt(saved) : 2; // Default to Jody's Line (working Twilio number)
  });

  const setConversationFilter = (id: number | null) => {
    setConversationFilterState(id);
    localStorage.setItem('conversationFilter', id === null ? 'null' : id.toString());
  };

  const setActiveSendLineId = (id: number) => {
    setActiveSendLineIdState(id);
    localStorage.setItem('activeSendLineId', id.toString());
  };

  // Legacy support for old code
  const setSelectedPhoneLineId = (id: number) => {
    setActiveSendLineId(id);
  };

  return (
    <PhoneLineContext.Provider value={{ 
      conversationFilter, 
      setConversationFilter,
      activeSendLineId, 
      setActiveSendLineId,
      selectedPhoneLineId: activeSendLineId,
      setSelectedPhoneLineId
    }}>
      {children}
    </PhoneLineContext.Provider>
  );
}

export function usePhoneLine() {
  const context = useContext(PhoneLineContext);
  if (context === undefined) {
    throw new Error('usePhoneLine must be used within a PhoneLineProvider');
  }
  return context;
}
