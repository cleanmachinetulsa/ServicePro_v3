import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2, CheckCircle, XCircle, Image as ImageIcon } from 'lucide-react';
import { useTechnician } from '@/contexts/TechnicianContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface UploadedPhoto {
  id: number;
  url: string;
  fileName: string;
  uploading?: boolean;
  error?: boolean;
}

const PHOTO_CATEGORIES = [
  'Before',
  'After',
  'Damage',
  'Interior',
  'Exterior',
];

export function MediaPod() {
  const { selectedJob } = useTechnician();
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Before');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handlePhotoCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedJob) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Add photo to UI with uploading state
      const tempId = Date.now() + i;
      const tempPhoto: UploadedPhoto = {
        id: tempId,
        url: URL.createObjectURL(file),
        fileName: file.name,
        uploading: true,
      };
      
      setPhotos(prev => [...prev, tempPhoto]);

      try {
        // Upload to backend
        const formData = new FormData();
        formData.append('photo', file);

        const response = await fetch(`/api/tech/jobs/${selectedJob.id}/photos`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();

        // Update photo with successful upload
        setPhotos(prev =>
          prev.map(p =>
            p.id === tempId
              ? { ...p, id: data.photo.id, url: data.photo.url, uploading: false }
              : p
          )
        );

        toast({
          title: 'Photo Uploaded',
          description: 'Photo saved to Google Drive',
        });
      } catch (error: any) {
        console.error('Photo upload error:', error);
        
        // Mark photo as error
        setPhotos(prev =>
          prev.map(p =>
            p.id === tempId
              ? { ...p, uploading: false, error: true }
              : p
          )
        );

        toast({
          title: 'Upload Failed',
          description: error.message || 'Failed to upload photo',
          variant: 'destructive',
        });
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const retryUpload = async (photoId: number) => {
    // Implement retry logic if needed
    toast({
      title: 'Retry Not Implemented',
      description: 'Please capture a new photo',
    });
  };

  if (!selectedJob) {
    return (
      <Card className="h-full bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-blue-300 text-sm">Select a job to upload photos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col bg-white/5 border-white/10">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Photo Documentation
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Category Selection */}
        <div>
          <h3 className="text-sm font-semibold text-blue-200 mb-2">Photo Category</h3>
          <div className="flex flex-wrap gap-2">
            {PHOTO_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-blue-300 hover:bg-white/20'
                }`}
                data-testid={`button-category-${category.toLowerCase()}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Capture Button */}
        <Button
          onClick={handlePhotoCapture}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-14"
          data-testid="button-capture-photo"
        >
          <Camera className="w-5 h-5 mr-2" />
          Capture Photo ({selectedCategory})
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Photo Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-200">
              Uploaded Photos ({photos.length})
            </h3>
          </div>

          {photos.length === 0 ? (
            <div className="bg-white/5 rounded-lg border-2 border-dashed border-white/20 p-8 flex flex-col items-center justify-center text-center">
              <ImageIcon className="w-12 h-12 text-blue-400 mb-3" />
              <p className="text-blue-300 text-sm">No photos uploaded yet</p>
              <p className="text-blue-400 text-xs mt-1">Capture photos to document the job</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-white/10 border border-white/20"
                >
                  <img
                    src={photo.url}
                    alt={photo.fileName}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Upload Status Overlay */}
                  {photo.uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                  
                  {photo.error && (
                    <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center gap-2">
                      <XCircle className="w-8 h-8 text-white" />
                      <Button
                        size="sm"
                        onClick={() => retryUpload(photo.id)}
                        className="text-xs"
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                  
                  {!photo.uploading && !photo.error && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="w-5 h-5 text-green-400 drop-shadow-lg" />
                    </div>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-white text-xs truncate">{photo.fileName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Tips */}
        <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/50">
          <p className="text-xs text-blue-200">
            <strong>Tip:</strong> Capture before/after photos for quality documentation.
            Photos are automatically uploaded to Google Drive.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
