import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  MapPin, 
  Tag as TagIcon,
  Loader2,
  AlertCircle,
  Star,
} from 'lucide-react';

export default function TechProfilePublic() {
  const [, params] = useRoute('/p/:publicId');
  const publicId = params?.publicId;

  // Fetch public profile
  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ['/api/tech/profile/public', publicId],
    enabled: !!publicId,
  });

  const profile = (profileData as any)?.profile;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
              <div>
                <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
                <p className="text-muted-foreground">
                  This technician profile could not be found or is not yet approved.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* Header with branding */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Clean Machine Auto Detail
            </h1>
            <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
          </div>
          <p className="text-sm text-muted-foreground">Meet Your Detailer</p>
        </div>

        {/* Profile Card */}
        <Card className="overflow-hidden shadow-xl">
          {/* Photo Header */}
          {profile.photoCard320Url && (
            <div className="relative h-64 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700">
              <img 
                src={profile.photoCard320Url} 
                alt={profile.preferredName}
                className="w-full h-full object-cover"
                data-testid="img-tech-photo"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              
              {/* Verified Badge */}
              {profile.verified && (
                <div className="absolute top-4 right-4">
                  <div className="bg-white dark:bg-slate-900 rounded-full p-2 shadow-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-500" data-testid="icon-verified" />
                  </div>
                </div>
              )}
            </div>
          )}

          <CardContent className="pt-6 space-y-6">
            {/* Name */}
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-1" data-testid="text-name">
                {profile.preferredName}
              </h2>
              {profile.verified && (
                <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium" data-testid="text-verified">Verified Technician</span>
                </div>
              )}
            </div>

            {/* City */}
            {profile.city && (
              <>
                <Separator />
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span data-testid="text-city">{profile.city}</span>
                </div>
              </>
            )}

            {/* Bio */}
            {profile.bioAbout && (
              <>
                <Separator />
                <div className="text-center">
                  <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 italic" data-testid="text-bio">
                    "{profile.bioAbout}"
                  </p>
                </div>
              </>
            )}

            {/* Specialties */}
            {profile.bioTags && profile.bioTags.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center justify-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                    <TagIcon className="w-4 h-4" />
                    <span>Specialties</span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {profile.bioTags.map((tag: string) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="text-sm px-3 py-1"
                        data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Footer message */}
            <Separator />
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>
                This technician has been verified by Clean Machine Auto Detail
              </p>
              <p className="text-xs">
                Questions? Contact us at (918) 555-0100
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Mobile-friendly spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
}
