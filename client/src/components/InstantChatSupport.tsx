import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface InstantChatSupportProps {
  onSupportRequestSent: (message: string, name: string, phone: string, email: string) => void;
}

export default function InstantChatSupport({ onSupportRequestSent }: InstantChatSupportProps) {
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }
    
    if (!phone.trim() && !email.trim()) {
      toast({
        title: "Contact Information Required",
        description: "Please provide either a phone number or email",
        variant: "destructive",
      });
      return;
    }
    
    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please tell us how we can help you",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Notify parent component about the support request
      onSupportRequestSent(message, name, phone, email);
      
      // Close dialog and reset form
      setSupportDialogOpen(false);
      toast({
        title: "Support Request Sent",
        description: "A team member will connect with you shortly",
      });
      
      // Reset form after successful submission
      setMessage("");
    } catch (error) {
      toast({
        title: "Request Failed",
        description: "Couldn't send your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setSupportDialogOpen(true)}
        className="fixed bottom-8 right-8 z-50 rounded-full w-16 h-16 shadow-lg bg-blue-600 hover:bg-blue-700 p-0 flex items-center justify-center animate-pulse"
        aria-label="Get instant support"
      >
        <MessageCircle className="h-8 w-8 text-white" />
      </Button>
      
      <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-blue-700">
              Get Instant Support
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="support-name" className="text-sm font-medium">
                Your Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="support-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="mt-1"
              />
            </div>
            
            <div>
              <label htmlFor="support-phone" className="text-sm font-medium">
                Phone Number
              </label>
              <Input
                id="support-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(918) 555-1234"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Phone number or email is required
              </p>
            </div>
            
            <div>
              <label htmlFor="support-email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="support-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
                className="mt-1"
              />
            </div>
            
            <div>
              <label htmlFor="support-message" className="text-sm font-medium">
                How can we help you? <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you need help with..."
                className="mt-1 min-h-[100px]"
              />
            </div>
            
            <div className="flex justify-between pt-2">
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Sending..." : "Connect with Support"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}