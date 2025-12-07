import { createContext, useContext } from 'react';
import { useUiExperienceMode, UiExperienceMode } from '@/hooks/useUiExperienceMode';

interface UiExperienceContextValue {
  mode: UiExperienceMode;
  isLoading: boolean;
  isSaving: boolean;
  toggleMode: () => Promise<void>;
  setMode: (mode: UiExperienceMode) => Promise<void>;
}

const UiExperienceContext = createContext<UiExperienceContextValue>({
  mode: 'simple',
  isLoading: false,
  isSaving: false,
  toggleMode: async () => {},
  setMode: async () => {},
});

export function UiExperienceProvider({ children }: { children: React.ReactNode }) {
  const { mode, isLoading, isSaving, saveMode } = useUiExperienceMode();

  const toggleMode = async () => {
    const newMode = mode === 'simple' ? 'advanced' : 'simple';
    await saveMode(newMode);
  };

  const setMode = async (newMode: UiExperienceMode) => {
    await saveMode(newMode);
  };

  return (
    <UiExperienceContext.Provider value={{ mode, isLoading, isSaving, toggleMode, setMode }}>
      {children}
    </UiExperienceContext.Provider>
  );
}

export function useUiExperience() {
  return useContext(UiExperienceContext);
}
