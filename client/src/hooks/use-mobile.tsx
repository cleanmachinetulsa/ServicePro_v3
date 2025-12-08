import * as React from "react"

const MOBILE_BREAKPOINT = 768
const PHONE_BREAKPOINT = 480

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

/**
 * Shared utility function to detect if device is a phone (not tablet/desktop).
 * Uses screen width + user agent to distinguish phones from iPads/tablets.
 * 
 * This is the single source of truth for phone detection.
 * Used by both useIsPhone hook and launch page redirect.
 */
export function detectIsPhone(): boolean {
  if (typeof window === 'undefined') return false;
  
  const width = window.innerWidth;
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check if it's an iPad (iPadOS 13+ reports as Mac, but check for touch)
  const isIPad = /ipad/.test(userAgent) || 
    (navigator.maxTouchPoints > 0 && /macintosh/.test(userAgent));
  
  // Check if it's a mobile phone (not tablet)
  // Phones typically have "mobile" in user agent after "android" or contain "iphone"
  const isMobilePhone = /iphone|android.*mobile|windows phone|blackberry/i.test(userAgent);
  
  // Phone = very small screen (< 480px) OR has mobile phone user agent, but NOT iPad
  const isSmallScreen = width < PHONE_BREAKPOINT;
  const isMediumScreen = width >= PHONE_BREAKPOINT && width < MOBILE_BREAKPOINT;
  
  return !isIPad && (isSmallScreen || (isMediumScreen && isMobilePhone));
}

/**
 * React hook that detects if the device is specifically a phone (not tablet or desktop).
 * Uses a combination of screen width and user agent detection.
 * 
 * Use cases:
 * - Phones → redirect to messages (mobile-first messaging)
 * - Tablets/Desktops → redirect to dashboard (full view)
 */
export function useIsPhone() {
  const [isPhone, setIsPhone] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const handleResize = () => setIsPhone(detectIsPhone())
    
    const mql = window.matchMedia(`(max-width: ${PHONE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", handleResize)
    handleResize()
    
    return () => mql.removeEventListener("change", handleResize)
  }, [])

  return !!isPhone
}
