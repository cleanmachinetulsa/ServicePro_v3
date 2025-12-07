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
  siteName = 'Clean Machine Auto Detail',
  ogImage 
}: SeoProps) {
  const isCleanMachine = useMemo(() => isCleanMachineHostname(), []);
  
  const fullTitle = `${title} | ${siteName}`;
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
    setMetaTag('og:site_name', siteName, true);
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
  }, [fullTitle, description, canonicalUrl, siteName, ogImage]);

  return null;
}

export default Seo;
