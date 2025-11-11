import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, 
  User, 
  MapPin, 
  Tag, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Upload,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const AVAILABLE_TAGS = [
  'Interior Specialist',
  'Exterior Expert',
  'Ceramic Coating',
  'Paint Correction',
  'Detailer',
  'Mobile Service',
  'Fleet Services',
  'Luxury Vehicles',
  'Classic Cars',
  'Eco-Friendly',
];

export default function TechWizard() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [photoUrls, setPhotoUrls] = useState<{ thumb: string; card: string; mms: string } | null>(null);
  const [preferredName, setPreferredName] = useState('');
  const [city, setCity] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bioAbout, setBioAbout] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [consent, setConsent] = useState(false);

  // Check if feature is enabled
  const { data: aiEnabledData } = useQuery({
    queryKey: ['/api/tech/settings/ai_bio_coach_enabled'],
  });
  const settingValue = (aiEnabledData as any)?.settingValue;
  const isAiEnabled = settingValue === true || settingValue?.enabled === true;

  // File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Photo upload mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      return apiRequest('POST', '/api/tech/profile/photo', formData, {
        headers: {}, // Let browser set Content-Type with boundary
      });
    },
    onSuccess: (data: any) => {
      setPhotoUrls({
        thumb: data.thumb96Url,
        card: data.card320Url,
        mms: data.mms640Url,
      });
      toast({
        title: 'Photo uploaded successfully',
        description: 'Your photo has been processed and optimized.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload photo. Please try a smaller image.',
        variant: 'destructive',
      });
    },
  });

  // AI bio suggestion mutation
  const aiSuggestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/ai/bio/suggest', {
        preferred_name: preferredName,
        city,
        tags: selectedTags,
        draft_notes: bioAbout,
      });
    },
    onSuccess: (data: any) => {
      setAiSuggestion(data.suggestion);
      toast({
        title: 'AI suggestion generated',
        description: 'Review the suggestion and decide if you want to use it.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'AI suggestion failed',
        description: error.message || 'Failed to generate suggestion. Try again later.',
        variant: 'destructive',
      });
    },
  });

  // Submit profile mutation
  const submitProfileMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/tech/profile', {
        preferredName,
        city,
        bioAbout,
        bioTags: selectedTags,
        photoThumb96Url: photoUrls?.thumb,
        photoCard320Url: photoUrls?.card,
        photoMms640Url: photoUrls?.mms,
        consent,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Profile submitted for review',
        description: 'Your profile is being reviewed by an administrator.',
      });
      setLocation('/tech/profile');
    },
    onError: (error: any) => {
      toast({
        title: 'Submission failed',
        description: error.message || 'Failed to submit profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleNextStep = () => {
    // Validation for each step
    if (currentStep === 1 && !selectedFile) {
      toast({
        title: 'Photo required',
        description: 'Please upload a photo to continue.',
        variant: 'destructive',
      });
      return;
    }

    if (currentStep === 1 && selectedFile && !photoUrls) {
      // Upload photo before proceeding
      uploadPhotoMutation.mutate(selectedFile);
      return;
    }

    if (currentStep === 2 && !preferredName) {
      toast({
        title: 'Name required',
        description: 'Please enter your preferred name.',
        variant: 'destructive',
      });
      return;
    }

    if (currentStep === 3 && !bioAbout && !aiSuggestion) {
      toast({
        title: 'Bio required',
        description: 'Please write a bio or generate one with AI.',
        variant: 'destructive',
      });
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleUseAiSuggestion = () => {
    setBioAbout(aiSuggestion);
    setAiSuggestion('');
  };

  const handleDismissSuggestion = () => {
    setAiSuggestion('');
  };

  const handleSubmit = () => {
    if (!consent) {
      toast({
        title: 'Consent required',
        description: 'Please agree to the terms before submitting.',
        variant: 'destructive',
      });
      return;
    }

    submitProfileMutation.mutate();
  };

  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="max-w-3xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome to Clean Machine! 🎉</h1>
          <p className="text-muted-foreground">
            Let's set up your technician profile in just a few steps
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2 text-sm text-muted-foreground">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round(progressPercent)}% Complete</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Wizard content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && 'Upload Your Photo'}
              {currentStep === 2 && 'Tell Us About Yourself'}
              {currentStep === 3 && 'Create Your Bio'}
              {currentStep === 4 && 'Review & Submit'}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Upload a professional photo that customers will see'}
              {currentStep === 2 && 'Add some basic information about you'}
              {currentStep === 3 && 'Write a short bio or let AI help you'}
              {currentStep === 4 && 'Review your profile before submitting for approval'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Photo Upload */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="photo-upload-zone"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-photo"
                  />
                  
                  {previewUrl ? (
                    <div className="space-y-4">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-48 h-48 object-cover rounded-full mx-auto border-4 border-primary"
                        data-testid="img-photo-preview"
                      />
                      <p className="text-sm text-muted-foreground">Click to change photo</p>
                      {selectedFile && (
                        <div className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Camera className="w-16 h-16 mx-auto text-muted-foreground" />
                      <div>
                        <p className="text-lg font-medium">Click to upload photo</p>
                        <p className="text-sm text-muted-foreground">
                          JPG, PNG, or WebP (max 10MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {photoUrls && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Photo uploaded and optimized for MMS delivery!
                    </AlertDescription>
                  </Alert>
                )}

                {uploadPhotoMutation.isPending && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                      Uploading and optimizing your photo...
                    </AlertDescription>
                  </Alert>
                )}

                {uploadPhotoMutation.isError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {(uploadPhotoMutation.error as any)?.message || 'Failed to upload photo'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Step 2: Personal Details */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="preferred-name" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Preferred Name *
                  </Label>
                  <Input
                    id="preferred-name"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    placeholder="What should customers call you?"
                    data-testid="input-preferred-name"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is how you'll appear to customers (e.g., "Mike", "Sarah")
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    City (Optional)
                  </Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Your city"
                    data-testid="input-city"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Specialties (Select all that apply)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TAGS.map((tag) => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => handleToggleTag(tag)}
                        data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Bio Creation */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bio" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Your Bio *
                  </Label>
                  <Textarea
                    id="bio"
                    value={bioAbout}
                    onChange={(e) => setBioAbout(e.target.value)}
                    placeholder="Tell customers about yourself, your experience, or what you love about detailing..."
                    rows={6}
                    maxLength={140}
                    data-testid="textarea-bio"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Keep it short and friendly!</span>
                    <span>{bioAbout.length}/140 characters</span>
                  </div>
                </div>

                {isAiEnabled && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => aiSuggestMutation.mutate()}
                      disabled={aiSuggestMutation.isPending || !bioAbout}
                      className="w-full"
                      data-testid="button-ai-improve"
                    >
                      {aiSuggestMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating AI suggestion...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Get AI Suggestion
                        </>
                      )}
                    </Button>

                    {aiSuggestion && (
                      <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertDescription className="space-y-4">
                          <div>
                            <strong>AI Suggestion:</strong>
                            <p className="mt-2 italic">{aiSuggestion}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleUseAiSuggestion}
                              data-testid="button-use-suggestion"
                            >
                              Use This Bio
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleDismissSuggestion}
                              data-testid="button-dismiss-suggestion"
                            >
                              Keep My Original
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 4: Review & Submit */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-4">Photo</h3>
                    {photoUrls && (
                      <img 
                        src={photoUrls.card} 
                        alt="Your photo" 
                        className="w-full h-64 object-cover rounded-lg border"
                        data-testid="img-review-photo"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Preferred Name</h3>
                      <p data-testid="text-review-name">{preferredName}</p>
                    </div>

                    {city && (
                      <div>
                        <h3 className="font-semibold mb-2">City</h3>
                        <p data-testid="text-review-city">{city}</p>
                      </div>
                    )}

                    {selectedTags.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Specialties</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedTags.map((tag) => (
                            <Badge key={tag} variant="secondary" data-testid={`review-tag-${tag}`}>
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Bio</h3>
                  <p className="text-muted-foreground italic" data-testid="text-review-bio">
                    {bioAbout}
                  </p>
                </div>

                <div className="flex items-start space-x-2 pt-4 border-t">
                  <Checkbox
                    id="consent"
                    checked={consent}
                    onCheckedChange={(checked) => setConsent(checked as boolean)}
                    data-testid="checkbox-consent"
                  />
                  <label
                    htmlFor="consent"
                    className="text-sm leading-relaxed cursor-pointer"
                  >
                    I consent to having my photo, name, and bio shared with customers via SMS, web, and other channels to enhance their service experience.
                  </label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevStep}
                disabled={currentStep === 1}
                data-testid="button-previous"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  onClick={handleNextStep}
                  disabled={uploadPhotoMutation.isPending}
                  data-testid="button-next"
                >
                  {uploadPhotoMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitProfileMutation.isPending || !consent}
                  data-testid="button-submit"
                >
                  {submitProfileMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Submit for Review
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
