import { createContext, useContext } from 'react';
import { useUiExperienceMode, UiExperienceMode } from '@/hooks/useUiExperienceMode';

interface UiExperienceContextValue {
  mode: UiExperienceMode;
  isLoading: boolean;
}

const UiExperienceContext = createContext<UiExperienceContextValue>({
  mode: 'simple',
  isLoading: false,
});

export function UiExperienceProvider({ children }: { children: React.ReactNode }) {
  const { mode, isLoading } = useUiExperienceMode();

  return (
    <UiExperienceContext.Provider value={{ mode, isLoading }}>
      {children}
    </UiExperienceContext.Provider>
  );
}

export function useUiExperience() {
  return useContext(UiExperienceContext);
}
