import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PhoneLineContextType {
  selectedPhoneLineId: number | null;
  setSelectedPhoneLineId: (id: number | null) => void;
}

const PhoneLineContext = createContext<PhoneLineContextType | undefined>(undefined);

export function PhoneLineProvider({ children }: { children: ReactNode }) {
  const [selectedPhoneLineId, setSelectedPhoneLineIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedPhoneLineId');
    return saved ? parseInt(saved) : 1;
  });

  const setSelectedPhoneLineId = (id: number | null) => {
    setSelectedPhoneLineIdState(id);
    if (id !== null) {
      localStorage.setItem('selectedPhoneLineId', id.toString());
    } else {
      localStorage.removeItem('selectedPhoneLineId');
    }
  };

  return (
    <PhoneLineContext.Provider value={{ selectedPhoneLineId, setSelectedPhoneLineId }}>
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
