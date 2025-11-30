type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [30, 30, 30],
  error: [50, 100, 50],
  selection: 5,
};

export function useHapticFeedback() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const trigger = (pattern: HapticPattern = 'light') => {
    if (!isSupported) return false;
    
    try {
      const vibrationPattern = HAPTIC_PATTERNS[pattern];
      navigator.vibrate(vibrationPattern);
      return true;
    } catch (e) {
      console.warn('[Haptic] Vibration failed:', e);
      return false;
    }
  };

  const light = () => trigger('light');
  const medium = () => trigger('medium');
  const heavy = () => trigger('heavy');
  const success = () => trigger('success');
  const warning = () => trigger('warning');
  const error = () => trigger('error');
  const selection = () => trigger('selection');

  return {
    isSupported,
    trigger,
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
  };
}

export function triggerHaptic(pattern: HapticPattern = 'light') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const vibrationPattern = HAPTIC_PATTERNS[pattern];
      navigator.vibrate(vibrationPattern);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}
