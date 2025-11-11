import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  X, 
  GripVertical, 
  Eye, 
  EyeOff,
  Loader2,
  Image as ImageIcon,
  Trash2,
  Download,
  Settings,
  Link as LinkIcon
} from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GalleryPhoto {
  id: number | string;
  imageUrl: string;
  title: string | null;
  description: string | null;
  displayOrder?: number;
  isActive: boolean;
  uploadedAt?: string;
  uploadedBy?: number | null;
  source?: string;
}

export default function GalleryPhotoManager() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<boolean>(false);
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);
  const [reorderedPhotos, setReorderedPhotos] = useState<GalleryPhoto[]>([]);
  const [useGooglePhotos, setUseGooglePhotos] = useState(false);
  const [showAlbumSettings, setShowAlbumSettings] = useState(false);
  const [albumUrl, setAlbumUrl] = useState(localStorage.getItem('googlePhotosAlbumUrl') || '');
  const [tempAlbumUrl, setTempAlbumUrl] = useState(albumUrl);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all gallery photos (including inactive)
  const { data: photosData, isLoading } = useQuery<{ success: boolean; photos: GalleryPhoto[] }>({
    queryKey: ['/api/gallery', { includeInactive: true }],
    queryFn: async () => {
      const response = await fetch('/api/gallery?includeInactive=true');
      if (!response.ok) throw new Error('Failed to fetch photos');
      return response.json();
    },
    enabled: !useGooglePhotos, // Only fetch local photos when not using Google Photos
  });

  // Fetch Google Photos album
  const { data: googlePhotosData, isLoading: isLoadingGoogle, refetch: refetchGooglePhotos } = useQuery<{ success: boolean; photos: GalleryPhoto[] }>({
    queryKey: ['/api/gallery/fetch-google-photos-album', albumUrl],
    queryFn: async () => {
      if (!albumUrl) {
        return { success: true, photos: [] };
      }
      const response = await fetch('/api/gallery/fetch-google-photos-album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumUrl })
      });
      if (!response.ok) throw new Error('Failed to fetch Google Photos');
      return response.json();
    },
    enabled: useGooglePhotos && !!albumUrl, // Only fetch when toggle is on and URL is set
  });

  const photos = useGooglePhotos 
    ? (googlePhotosData?.photos || []) 
    : (photosData?.photos || []);

  // Set reordered photos when photos data changes
  if (photos.length > 0 && reorderedPhotos.length === 0) {
    setReorderedPhotos(photos);
  }

  // Upload photos mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('photos', file);
      });

      return await apiRequest('POST', '/api/gallery', formData, {
        headers: {}, // Let browser set Content-Type with boundary
      });
    },
    onSuccess: async () => {
      toast({ title: 'Success', description: `Uploaded ${selectedFiles.length} photo(s)` });
      setSelectedFiles([]);
      setUploadProgress(false);
      queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Upload Failed', 
        description: error.message || 'Failed to upload photos',
        variant: 'destructive' 
      });
      setUploadProgress(false);
    },
  });

  // Delete photo mutation
  const deleteMutation = useMutation({
    mutationFn: async (photoId: number) => {
      return await apiRequest('DELETE', `/api/gallery/${photoId}`);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Photo deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
      setPhotoToDelete(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Delete Failed', 
        description: error.message || 'Failed to delete photo',
        variant: 'destructive' 
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return await apiRequest('PATCH', `/api/gallery/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
    },
  });

  // Reorder photos mutation
  const reorderMutation = useMutation({
    mutationFn: async (photos: { id: number; displayOrder: number }[]) => {
      return await apiRequest('POST', '/api/gallery/reorder', { photos });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Photo order updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
    },
  });

  // Sync Google Business photos mutation
  const syncGooglePhotosMutation = useMutation({
    mutationFn: async () => {
      const googlePlaceId = localStorage.getItem('googlePlaceId') || '';
      return await apiRequest('POST', '/api/gallery/sync-google-photos', { googlePlaceId });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: 'Google Photos Synced', 
        description: `${data.photosAdded || 0} photos added from Google Business Profile` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Sync Failed', 
        description: error.message || 'Failed to sync Google Business photos',
        variant: 'destructive' 
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/')
      );
      setSelectedFiles(prev => [...prev, ...files]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    setUploadProgress(true);
    uploadMutation.mutate(selectedFiles);
  };

  const handleReorder = (newOrder: GalleryPhoto[]) => {
    setReorderedPhotos(newOrder);
    // Only reorder local photos (number IDs), filter out Google Photos (string IDs)
    const photoUpdates = newOrder
      .filter(photo => typeof photo.id === 'number')
      .map((photo, index) => ({
        id: photo.id as number,
        displayOrder: index,
      }));
    if (photoUpdates.length > 0) {
      reorderMutation.mutate(photoUpdates);
    }
  };

  const handleSaveAlbumUrl = () => {
    localStorage.setItem('googlePhotosAlbumUrl', tempAlbumUrl);
    setAlbumUrl(tempAlbumUrl);
    setShowAlbumSettings(false);
    if (useGooglePhotos && tempAlbumUrl) {
      refetchGooglePhotos();
    }
    toast({ title: 'Success', description: 'Album URL saved successfully' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Gallery Photo Manager
              </CardTitle>
              <CardDescription>
                {useGooglePhotos 
                  ? 'Displaying photos from Google Photos shared album'
                  : 'Upload and manage photos for your public gallery page. Drag photos to reorder them.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {/* Toggle between local and Google Photos */}
              <div className="flex items-center gap-2">
                <Label htmlFor="google-photos-toggle" className="text-sm">
                  {useGooglePhotos ? 'Google Photos' : 'Local Photos'}
                </Label>
                <Switch
                  id="google-photos-toggle"
                  checked={useGooglePhotos}
                  onCheckedChange={(checked) => {
                    if (checked && !albumUrl) {
                      setShowAlbumSettings(true);
                    }
                    setUseGooglePhotos(checked);
                  }}
                  data-testid="toggle-google-photos"
                />
              </div>

              {/* Album settings button - only show when using Google Photos */}
              {useGooglePhotos && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAlbumSettings(true)}
                  data-testid="button-album-settings"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Album Settings
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section - Only show for local photos */}
          {!useGooglePhotos && (
          <div className="space-y-4">
            <Label>Upload New Photos</Label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
            >
              <Input
                id="file-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-gallery-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium mb-2">
                  Drop photos here or click to browse
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Supports JPEG, PNG, WEBP • Max 10MB per file • Upload multiple photos at once
                </p>
              </label>
            </div>

            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{selectedFiles.length} file(s) selected</Label>
                  <Button 
                    onClick={handleUpload} 
                    disabled={uploadProgress}
                    size="sm"
                    data-testid="button-upload-photos"
                  >
                    {uploadProgress ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload {selectedFiles.length} Photo(s)
                      </>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {selectedFiles.map((file, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative aspect-square rounded-lg overflow-hidden border"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeSelectedFile(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        data-testid={`button-remove-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Business Photos Sync */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Import from Google Business</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Automatically fetch photos from your Google Business Profile
                  </p>
                </div>
                <Button 
                  onClick={() => syncGooglePhotosMutation.mutate()}
                  disabled={syncGooglePhotosMutation.isPending}
                  variant="outline"
                  size="sm"
                  data-testid="button-sync-google-photos"
                >
                  {syncGooglePhotosMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Sync from Google
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          )}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Current Photos ({photos.length})</Label>
              {!useGooglePhotos && <Badge variant="outline">Drag to reorder</Badge>}
              {useGooglePhotos && <Badge variant="secondary">Read-only (from Google Photos)</Badge>}
            </div>

            {(isLoading || isLoadingGoogle) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : reorderedPhotos.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <ImageIcon className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>{useGooglePhotos ? 'No photos found in album' : 'No photos uploaded yet'}</p>
              </div>
            ) : useGooglePhotos ? (
              // Display Google Photos (read-only grid)
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-lg overflow-hidden border hover:shadow-lg transition-shadow"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={photo.title || `Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2">
                      <p className="text-xs truncate">{photo.title || `Photo ${index + 1}`}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Display local photos (draggable list)
              <Reorder.Group
                axis="y"
                values={reorderedPhotos}
                onReorder={handleReorder}
                className="space-y-2"
              >
                {reorderedPhotos.map((photo) => (
                  <Reorder.Item
                    key={photo.id}
                    value={photo}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border cursor-move hover:shadow-md transition-shadow"
                  >
                    <GripVertical className="h-5 w-5 text-gray-400" />
                    <img
                      src={photo.imageUrl}
                      alt={photo.title || `Gallery photo ${photo.id}`}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {photo.title || `Photo ${photo.id}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        Order: {photo.displayOrder}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActiveMutation.mutate({ 
                          id: typeof photo.id === 'number' ? photo.id : 0, 
                          isActive: !photo.isActive 
                        })}
                        data-testid={`button-toggle-${photo.id}`}
                      >
                        {photo.isActive ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => typeof photo.id === 'number' && setPhotoToDelete(photo.id)}
                        data-testid={`button-delete-${photo.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={photoToDelete !== null} onOpenChange={() => setPhotoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this photo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => photoToDelete && deleteMutation.mutate(photoToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Google Photos Album Settings Dialog */}
      <Dialog open={showAlbumSettings} onOpenChange={setShowAlbumSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Photos Album Settings</DialogTitle>
            <DialogDescription>
              Enter the shared URL of your Google Photos album. The album must be publicly shared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="album-url">Google Photos Album URL</Label>
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-gray-400" />
                <Input
                  id="album-url"
                  value={tempAlbumUrl}
                  onChange={(e) => setTempAlbumUrl(e.target.value)}
                  placeholder="https://photos.app.goo.gl/..."
                  data-testid="input-album-url"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                To get the URL: Open your album in Google Photos → Share → Copy link
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> This feature uses an unofficial method to access Google Photos albums.
                It may stop working if Google changes their system. Make sure your album is publicly shared.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTempAlbumUrl(albumUrl);
              setShowAlbumSettings(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveAlbumUrl} data-testid="button-save-album-url">
              Save Album URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}