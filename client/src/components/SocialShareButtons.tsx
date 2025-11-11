import React from 'react';
import { Share2, Facebook, Twitter, MessageCircle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface SocialShareButtonsProps {
  serviceName: string;
  serviceDescription: string;
  priceRange: string;
  businessName?: string;
  businessUrl?: string;
}

export function SocialShareButtons({ 
  serviceName, 
  serviceDescription, 
  priceRange,
  businessName = "Clean Machine Auto Detail",
  businessUrl = window.location.origin
}: SocialShareButtonsProps) {
  const { toast } = useToast();

  // Create shareable content
  const shareText = `Check out ${serviceName} at ${businessName}! ${priceRange} - ${serviceDescription.substring(0, 100)}...`;
  const shareUrl = `${businessUrl}/#${serviceName.toLowerCase().replace(/\s+/g, '-')}`;
  const hashtags = 'autodetailing,carcare,tulsa,cleanmachine';

  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
  };

  const shareToTwitter = () => {
    const twitterText = `${shareText} #${hashtags.replace(/,/g, ' #')}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  const shareToWhatsApp = () => {
    const whatsappText = `${shareText} ${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
    window.open(whatsappUrl, '_blank');
  };

  const copyToClipboard = async () => {
    const textToCopy = `${shareText}\n\n${shareUrl}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Link copied!",
        description: "Service details copied to clipboard",
      });
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast({
        title: "Link copied!",
        description: "Service details copied to clipboard",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={shareToFacebook} className="gap-2 cursor-pointer">
          <Facebook className="h-4 w-4 text-blue-600" />
          Share on Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToTwitter} className="gap-2 cursor-pointer">
          <Twitter className="h-4 w-4 text-blue-400" />
          Share on Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToWhatsApp} className="gap-2 cursor-pointer">
          <MessageCircle className="h-4 w-4 text-green-600" />
          Share on WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyToClipboard} className="gap-2 cursor-pointer">
          <Link2 className="h-4 w-4" />
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}