/**
 * TenantSuggestionModal - Platform Suggestion Modal
 * 
 * Allows tenant owners/staff to submit suggestions to the ServicePro platform.
 * Categories: feature, bug, improvement, ui, other
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
  Lightbulb, 
  Bug, 
  Sparkles, 
  Palette, 
  HelpCircle,
  Send,
  Loader2
} from "lucide-react";

interface TenantSuggestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  { value: "feature", label: "New Feature", icon: Lightbulb, description: "Suggest a new capability" },
  { value: "bug", label: "Bug Report", icon: Bug, description: "Report something broken" },
  { value: "improvement", label: "Improvement", icon: Sparkles, description: "Enhance existing features" },
  { value: "ui", label: "UI/UX", icon: Palette, description: "Design & usability feedback" },
  { value: "other", label: "Other", icon: HelpCircle, description: "General feedback" },
];

export default function TenantSuggestionModal({ 
  open, 
  onOpenChange 
}: TenantSuggestionModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("feature");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/platform-suggestions", {
        title: title.trim(),
        category,
        message: message.trim(),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Suggestion submitted!",
        description: "Thank you for your feedback. We'll review it soon.",
      });
      setTitle("");
      setCategory("feature");
      setMessage("");
      onOpenChange(false);
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
        description: "Please enter a title for your suggestion.",
        variant: "destructive",
      });
      return;
    }
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please describe your suggestion.",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate();
  };

  const selectedCategory = categories.find(c => c.value === category);
  const CategoryIcon = selectedCategory?.icon || Lightbulb;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <Lightbulb className="h-5 w-5 text-white" />
            </div>
            Suggest a Feature
          </DialogTitle>
          <DialogDescription>
            Help us improve ServicePro! Share your ideas, report bugs, or suggest improvements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-suggestion-category">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <CategoryIcon className="h-4 w-4" />
                    <span>{selectedCategory?.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <SelectItem 
                      key={cat.value} 
                      value={cat.value}
                      data-testid={`option-category-${cat.value}`}
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
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your suggestion"
              maxLength={255}
              data-testid="input-suggestion-title"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Details</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your suggestion in detail. What problem does it solve? How would it work?"
              rows={5}
              className="resize-none"
              data-testid="input-suggestion-message"
            />
            <p className="text-xs text-muted-foreground">
              The more detail you provide, the better we can understand your suggestion.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitMutation.isPending}
            data-testid="button-cancel-suggestion"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !title.trim() || !message.trim()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            data-testid="button-submit-suggestion"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Suggestion
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
