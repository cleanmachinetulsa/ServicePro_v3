/**
 * CustomerSuggestionBox - Public Customer Feedback Component
 * 
 * A glassmorphism-styled suggestion box that customers can use to submit
 * feedback or suggestions to the tenant's business.
 * 
 * Mobile-first design (393px primary viewport)
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquarePlus, 
  Send, 
  Loader2, 
  CheckCircle,
  Sparkles
} from "lucide-react";

interface CustomerSuggestionBoxProps {
  tenantName?: string;
  className?: string;
}

export default function CustomerSuggestionBox({ 
  tenantName = "our business",
  className = ""
}: CustomerSuggestionBoxProps) {
  const [message, setMessage] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/public/customer-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: message.trim(),
          contactPhone: contactPhone.trim() || null,
          contactEmail: contactEmail.trim() || null,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit suggestion");
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      setMessage("");
      setContactPhone("");
      setContactEmail("");
      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please share your thoughts before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    submitMutation.mutate();
  };

  // Success state
  if (isSubmitted) {
    return (
      <Card className={`relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-green-50/90 to-emerald-50/90 dark:from-green-950/50 dark:to-emerald-950/50 border border-green-200/50 dark:border-green-800/50 ${className}`}>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
                Thank You!
              </h3>
              <p className="text-green-700 dark:text-green-300 text-sm">
                Your feedback helps us serve you better.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSubmitted(false)}
              className="mt-2 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
              data-testid="button-submit-another"
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Submit Another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-purple-50/90 via-blue-50/90 to-cyan-50/90 dark:from-purple-950/50 dark:via-blue-950/50 dark:to-cyan-950/50 border border-purple-200/50 dark:border-purple-800/50 shadow-xl ${className}`}>
      {/* Decorative gradient orbs */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-cyan-400/20 to-purple-400/20 rounded-full blur-3xl" />
      
      <CardContent className="relative pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Share Your Ideas
            </h3>
            <p className="text-sm text-muted-foreground">
              Help {tenantName} improve
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="suggestion-message" className="text-sm font-medium">
              Your Feedback <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="suggestion-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What would make your experience better? Share any ideas, suggestions, or feedback..."
              rows={4}
              className="resize-none bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-purple-200/50 dark:border-purple-700/50 focus:border-purple-400 dark:focus:border-purple-500"
              data-testid="input-customer-suggestion-message"
            />
          </div>

          {/* Optional Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="suggestion-phone" className="text-xs text-muted-foreground">
                Phone (optional)
              </Label>
              <Input
                id="suggestion-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="h-9 text-sm bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-purple-200/50 dark:border-purple-700/50"
                data-testid="input-customer-suggestion-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suggestion-email" className="text-xs text-muted-foreground">
                Email (optional)
              </Label>
              <Input
                id="suggestion-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-9 text-sm bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-purple-200/50 dark:border-purple-700/50"
                data-testid="input-customer-suggestion-email"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Contact info is optional. Add it if you'd like us to follow up.
          </p>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={submitMutation.isPending || !message.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/20 dark:shadow-purple-500/10"
            data-testid="button-submit-customer-suggestion"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Feedback
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
