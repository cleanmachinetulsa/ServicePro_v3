import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SMSConsentCheckbox } from "@/components/SMSConsentCheckbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, CheckCircle2, Shield } from "lucide-react";

export default function SMSConsentPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim() || !consent) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields and provide consent",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sms-consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          name,
          consent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record consent");
      }

      setSubmitted(true);
      toast({
        title: "Consent Recorded",
        description: "Thank you for providing your consent. You may now receive SMS messages from us.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record consent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Consent Recorded</CardTitle>
            <CardDescription>
              Thank you for providing your consent. You're all set to receive SMS messages from Clean Machine Auto Detail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-sm mb-2">What happens next?</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• You'll receive appointment reminders via SMS</li>
                <li>• We'll send service updates and confirmations</li>
                <li>• You can reply STOP at any time to unsubscribe</li>
                <li>• Standard message and data rates may apply</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-2xl">SMS Messaging Consent</CardTitle>
              <CardDescription>Clean Machine Auto Detail</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">
                  Clean Machine Auto Detail uses SMS messaging to provide you with appointment reminders, 
                  service updates, and important notifications about your auto detailing services.
                </p>
                <p className="font-medium">
                  By providing your consent below, you agree to receive these informational messages and alerts.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  data-testid="input-name"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  required
                  data-testid="input-phone"
                />
              </div>
            </div>

            <SMSConsentCheckbox
              checked={consent}
              onCheckedChange={setConsent}
              required={true}
              id="sms-consent-form"
            />

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={!consent || isSubmitting}
                data-testid="button-submit-consent"
              >
                {isSubmitting ? "Recording Consent..." : "Submit Consent"}
              </Button>
            </div>

            <div className="text-xs text-center text-muted-foreground space-y-1">
              <p>Message frequency varies based on your appointments and service needs.</p>
              <p>Message and data rates may apply.</p>
              <p>You can reply STOP to any message to opt-out at any time.</p>
              <p>Reply HELP for assistance.</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
