import { useEffect } from "react";
import { useLocation } from "wouter";
import { CLEAN_MACHINE_DOMAIN, CLEAN_MACHINE_TENANT_SLUG } from "@shared/domainConfig";
import LandingPage from "@/pages/LandingPage";

function isCleanMachineDomain(): boolean {
  const host = window.location.hostname.toLowerCase();
  const cleanMachineDomain = CLEAN_MACHINE_DOMAIN.toLowerCase();
  return host === cleanMachineDomain || host === `www.${cleanMachineDomain}`;
}

/**
 * CM-DNS-2: Root Domain Handler
 * 
 * This component wraps the root "/" route and checks the browser hostname.
 * - If accessed via cleanmachinetulsa.com, redirects to /site/cleanmachine
 * - Otherwise, shows the standard ServicePro landing page
 */
export default function RootDomainHandler() {
  const [, setLocation] = useLocation();
  const isCleanMachine = isCleanMachineDomain();

  useEffect(() => {
    if (isCleanMachine) {
      setLocation(`/site/${CLEAN_MACHINE_TENANT_SLUG}`, { replace: true });
    }
  }, [isCleanMachine, setLocation]);

  if (isCleanMachine) {
    return null;
  }

  return <LandingPage />;
}
