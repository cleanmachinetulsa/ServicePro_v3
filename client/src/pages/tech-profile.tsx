import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, 
  User, 
  MapPin, 
  Tag, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  Upload,
  Loader2,
  AlertCircle,
  Save,
  RefreshCw,
  ArrowLeft,
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

export default function TechProfile() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [preferredName, setPreferredName] = useState('');
  const [city, setCity] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bioAbout, setBioAbout] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current profile
  const { data: profileData, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['/api/tech/profile'],
    refetchOnWindowFocus: false,
  });

  const profile = (profileData as any)?.profile;

  // Initialize form with current profile data
  useEffect(() => {
    if (profile) {
      setPreferredName(profile.preferredName || '');
      setCity(profile.city || '');
      setSelectedTags(profile.bioTags || []);
      setBioAbout(profile.bioAbout || '');
      if (profile.photoCard320Url) {
        setPreviewUrl(profile.photoCard320Url);
      }
    }
  }, [profile]);

  // Redirect to wizard if no profile exists
  useEffect(() => {
    if (!isLoadingProfile && !profile) {
      toast({
        title: 'No profile found',
        description: 'Redirecting to first-run wizard...',
      });
      setTimeout(() => {
        setLocation('/tech/wizard');
      }, 1500);
    }
  }, [isLoadingProfile, profile, setLocation, toast]);

  // Check if AI feature is enabled
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
      setHasChanges(true);
    }
  };

  // Photo upload mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      return apiRequest('POST', '/api/tech/profile/photo', formData, {
        headers: {},
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Photo updated',
        description: 'Your photo has been processed and will be reviewed.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tech/profile'] });
      setSelectedFile(null);
      setHasChanges(true);
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

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', `/api/tech/profile/${profile.id}`, {
        preferredName,
        city,
        bioAbout,
        bioTags: selectedTags,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Profile updated',
        description: 'Your changes have been submitted for review.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tech/profile'] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
    setHasChanges(true);
  };

  const handleUseAiSuggestion = () => {
    setBioAbout(aiSuggestion);
    setAiSuggestion('');
    setHasChanges(true);
  };

  const handleDismissSuggestion = () => {
    setAiSuggestion('');
  };

  const handleSaveChanges = () => {
    if (!preferredName) {
      toast({
        title: 'Name required',
        description: 'Please enter your preferred name.',
        variant: 'destructive',
      });
      return;
    }

    if (!bioAbout) {
      toast({
        title: 'Bio required',
        description: 'Please write a bio.',
        variant: 'destructive',
      });
      return;
    }

    updateProfileMutation.mutate();
  };

  const handleUploadPhoto = () => {
    if (selectedFile) {
      uploadPhotoMutation.mutate(selectedFile);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Redirecting to wizard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">My Profile</h1>
            <p className="text-muted-foreground mt-1">
              Update your bio and photo. Changes require admin approval.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation('/dashboard')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Profile Status */}
        {profile && (
          <Alert className="mb-6">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>Status:</strong> {profile.status === 'approved' ? '✅ Approved' : profile.status === 'pending' ? '⏳ Pending Review' : '❌ Rejected'}
              {profile.status === 'rejected' && profile.adminNotes && (
                <div className="mt-2 text-sm text-destructive">
                  <strong>Admin notes:</strong> {profile.adminNotes}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Photo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Profile Photo
              </CardTitle>
              <CardDescription>Upload a professional photo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
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
                  <div className="space-y-2">
                    <img 
                      src={previewUrl} 
                      alt="Profile" 
                      className="w-full h-48 object-cover rounded-lg"
                      data-testid="img-photo-preview"
                    />
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2 py-8">
                    <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
                    <p className="text-sm">Click to upload</p>
                  </div>
                )}
              </div>

              {selectedFile && (
                <Button
                  onClick={handleUploadPhoto}
                  disabled={uploadPhotoMutation.isPending}
                  className="w-full"
                  data-testid="button-upload-photo"
                >
                  {uploadPhotoMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload New Photo
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Right Column - Bio Editor */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="preferred-name">Preferred Name *</Label>
                  <Input
                    id="preferred-name"
                    value={preferredName}
                    onChange={(e) => {
                      setPreferredName(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="What should customers call you?"
                    data-testid="input-preferred-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    City (Optional)
                  </Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Your city"
                    data-testid="input-city"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Specialties
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Your Bio
                </CardTitle>
                <CardDescription>
                  Write a short bio about yourself (max 140 characters)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    value={bioAbout}
                    onChange={(e) => {
                      setBioAbout(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Tell customers about yourself..."
                    rows={4}
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
                              Keep My Current
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/tech/profile'] })}
                disabled={updateProfileMutation.isPending}
                data-testid="button-reset"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset Changes
              </Button>
              <Button
                onClick={handleSaveChanges}
                disabled={updateProfileMutation.isPending || !hasChanges}
                data-testid="button-save"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
