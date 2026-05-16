import { CLEAN_MACHINE_DOMAIN } from "@shared/domainConfig";
import LandingPage from "@/pages/LandingPage";
import HomePage from "@/pages/home";

function isCleanMachineDomain(): boolean {
  const host = window.location.hostname.toLowerCase();
  const cleanMachineDomain = CLEAN_MACHINE_DOMAIN.toLowerCase();
  if (host === cleanMachineDomain || host === `www.${cleanMachineDomain}`) {
    return true;
  }
  // Preview/dev hostnames (Replit) also render the Clean Machine HomePage
  // so the owner can preview their actual custom homepage from the workspace
  // preview pane instead of the ServicePro marketing LandingPage.
  if (host.endsWith('.replit.dev') || host.endsWith('.replit.app') || host.endsWith('.repl.co')) {
    return true;
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return true;
  }
  return false;
}

/**
 * ============================================================================
 * ROOT DOMAIN HANDLER - CRITICAL ROUTING COMPONENT
 * ============================================================================
 * 
 * DO NOT MODIFY WITHOUT OWNER APPROVAL
 * 
 * This component controls what homepage is shown based on the browser's domain.
 * 
 * ROUTING RULES:
 * 
 * 1. cleanmachinetulsa.com / www.cleanmachinetulsa.com
 *    → Renders: HomePage (client/src/pages/home.tsx)
 *    → This is the CUSTOM, HAND-BUILT homepage with 7 template options
 *    → Content is editable via /admin/homepage-editor
 *    → NEVER route this to PublicSite or /site/cleanmachine
 * 
 * 2. Replit preview/dev hostnames (*.replit.dev, *.replit.app, *.repl.co)
 *    and localhost / 127.0.0.1
 *    → Renders: HomePage so the owner can preview the real Clean Machine
 *      homepage from the workspace preview pane.
 *
 * 3. All other domains
 *    → Renders: LandingPage (the ServicePro marketing page)
 * 
 * WHY THIS MATTERS:
 * - PublicSite (/site/:subdomain) is the AUTO-GENERATED tenant landing page
 * - HomePage is the CUSTOM Clean Machine homepage built specifically for them
 * - These are DIFFERENT pages and should NEVER be confused
 * 
 * HISTORY:
 * - The Clean Machine homepage predates the PublicSite system
 * - CM-DNS work accidentally routed the domain to PublicSite
 * - This was corrected to always use HomePage for Clean Machine
 * 
 * ============================================================================
 */
export default function RootDomainHandler() {
  const isCleanMachine = isCleanMachineDomain();

  if (isCleanMachine) {
    return <HomePage />;
  }

  return <LandingPage />;
}
