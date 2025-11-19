import { createContext, useContext, useState, ReactNode } from 'react';

interface ShowcaseContextType {
  trialModalOpen: boolean;
  openTrialModal: () => void;
  closeTrialModal: () => void;
}

const ShowcaseContext = createContext<ShowcaseContextType | undefined>(undefined);

export function ShowcaseProvider({ children }: { children: ReactNode }) {
  const [trialModalOpen, setTrialModalOpen] = useState(false);

  return (
    <ShowcaseContext.Provider
      value={{
        trialModalOpen,
        openTrialModal: () => setTrialModalOpen(true),
        closeTrialModal: () => setTrialModalOpen(false),
      }}
    >
      {children}
    </ShowcaseContext.Provider>
  );
}

export function useShowcase() {
  const context = useContext(ShowcaseContext);
  if (!context) {
    throw new Error('useShowcase must be used within ShowcaseProvider');
  }
  return context;
}
