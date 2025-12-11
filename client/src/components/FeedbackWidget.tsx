/**
 * FeedbackWidget - Floating Feedback/Bug Report Button
 * 
 * A floating action button that opens a feedback modal for users to submit
 * suggestions, bug reports, and general feedback about the platform.
 * Available from any page in the app.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Bug, 
  Lightbulb, 
  Send,
  Loader2,
  X
} from "lucide-react";

const categories = [
  { value: "bug", label: "Bug Report", description: "Report something broken" },
  { value: "feature", label: "Feature Request", description: "Suggest a new capability" },
  { value: "improvement", label: "Improvement", description: "Enhance existing features" },
  { value: "other", label: "General Feedback", description: "Other comments" },
];

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("bug");
  const [message, setMessage] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/user-feedback", {
        title: title.trim(),
        category,
        message: message.trim(),
        contactInfo: contactInfo.trim() || null,
      });
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted. We'll review it shortly.",
      });
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
        setTitle("");
        setCategory("bug");
        setMessage("");
        setContactInfo("");
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your feedback.",
        variant: "destructive",
      });
      return;
    }
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please describe your feedback.",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate();
  };

  const handleClose = () => {
    if (!submitMutation.isPending) {
      setIsOpen(false);
      setIsSubmitted(false);
      setTitle("");
      setCategory("bug");
      setMessage("");
      setContactInfo("");
    }
  };

  const selectedCategory = categories.find(c => c.value === category);

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-110"
        title="Send feedback or report a bug"
        aria-label="Open feedback form"
        data-testid="button-open-feedback"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Feedback Modal */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                Help Us Improve
              </DialogTitle>
              <button
                onClick={handleClose}
                disabled={submitMutation.isPending}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
                data-testid="button-close-feedback"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <DialogDescription>
              Found a bug? Have a feature idea? Share your feedback to help us make the platform better.
            </DialogDescription>
          </DialogHeader>

          {isSubmitted ? (
            // Success State
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                <MessageCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 text-center mb-2">
                Thank You!
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Your feedback has been submitted and will be reviewed by our team.
              </p>
            </div>
          ) : (
            // Form State
            <div className="space-y-4 py-4">
              {/* Category Selection */}
              <div className="space-y-2">
                <Label htmlFor="feedback-category" className="text-sm font-medium">
                  Type <span className="text-red-500">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-feedback-category">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {category === 'bug' && <Bug className="h-4 w-4" />}
                        {category === 'feature' && <Lightbulb className="h-4 w-4" />}
                        {category === 'improvement' && <Lightbulb className="h-4 w-4" />}
                        {category === 'other' && <MessageCircle className="h-4 w-4" />}
                        <span>{selectedCategory?.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => {
                      const Icon = cat.value === 'bug' ? Bug : Lightbulb;
                      return (
                        <SelectItem 
                          key={cat.value} 
                          value={cat.value}
                          data-testid={`option-feedback-${cat.value}`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{cat.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {cat.description}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="feedback-title" className="text-sm font-medium">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="feedback-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary"
                  maxLength={255}
                  data-testid="input-feedback-title"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="feedback-message" className="text-sm font-medium">
                  Details <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what happened or what you'd like to see..."
                  rows={4}
                  className="resize-none"
                  data-testid="input-feedback-message"
                />
              </div>

              {/* Contact Info (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="feedback-contact" className="text-sm font-medium text-muted-foreground">
                  Contact Info (optional)
                </Label>
                <Input
                  id="feedback-contact"
                  type="email"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="your@email.com or phone number"
                  data-testid="input-feedback-contact"
                />
                <p className="text-xs text-muted-foreground">
                  Add your email or phone if you'd like us to follow up.
                </p>
              </div>
            </div>
          )}

          {!isSubmitted && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={submitMutation.isPending}
                data-testid="button-cancel-feedback"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending || !title.trim() || !message.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-testid="button-submit-feedback"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Feedback
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
