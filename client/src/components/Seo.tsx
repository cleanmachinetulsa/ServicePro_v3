import { useEffect, useMemo } from 'react';
import { 
  CLEAN_MACHINE_CANONICAL_URL, 
  CLEAN_MACHINE_ROOT, 
  CLEAN_MACHINE_WWW 
} from '@shared/domainConfig';

interface SeoProps {
  title: string;
  description: string;
  canonicalPath?: string;
  siteName?: string;
  ogImage?: string;
}

function setMetaTag(name: string, content: string, isProperty = false) {
  const attributeName = isProperty ? 'property' : 'name';
  let element = document.querySelector(`meta[${attributeName}="${name}"]`) as HTMLMetaElement | null;
  
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonicalLink(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

function isCleanMachineHostname(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === CLEAN_MACHINE_ROOT || hostname === CLEAN_MACHINE_WWW;
}

export function Seo({ 
  title, 
  description, 
  canonicalPath,
  siteName,
  ogImage 
}: SeoProps) {
  const isCleanMachine = useMemo(() => isCleanMachineHostname(), []);

  // Stage 1C-b: when no siteName is passed, fall back to the current
  // document.title which useTenantMeta() has already set from the
  // authenticated tenant's businessName. For Clean Machine this still
  // resolves to "Clean Machine Auto Detail"; for other tenants it picks up
  // their actual business name instead of the previous hardcoded literal.
  const resolvedSiteName =
    siteName ||
    (typeof document !== 'undefined' && document.title && document.title !== 'Loading...'
      ? document.title
      : '');
  const fullTitle = resolvedSiteName ? `${title} | ${resolvedSiteName}` : title;
  const canonicalUrl = useMemo(() => {
    if (!canonicalPath) return undefined;
    if (isCleanMachine) {
      return `${CLEAN_MACHINE_CANONICAL_URL}${canonicalPath}`;
    }
    return `${window.location.origin}${canonicalPath}`;
  }, [canonicalPath, isCleanMachine]);

  useEffect(() => {
    document.title = fullTitle;

    setMetaTag('description', description);

    setMetaTag('og:title', fullTitle, true);
    setMetaTag('og:description', description, true);
    if (resolvedSiteName) {
      setMetaTag('og:site_name', resolvedSiteName, true);
    }
    setMetaTag('og:type', 'website', true);

    if (canonicalUrl) {
      setCanonicalLink(canonicalUrl);
      setMetaTag('og:url', canonicalUrl, true);
    }

    if (ogImage) {
      setMetaTag('og:image', ogImage, true);
    }

    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', fullTitle);
    setMetaTag('twitter:description', description);

    return () => {
    };
  }, [fullTitle, description, canonicalUrl, resolvedSiteName, ogImage]);

  return null;
}

export default Seo;
