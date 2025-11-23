import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { INDUSTRY_PACKS } from "@/config/industryPacks";
import { Upload, ExternalLink } from "lucide-react";

export default function AdminIndustryImages() {
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({});

  const handleFileSelect = (industryId: string, file: File | null) => {
    if (!file) return;
    
    setSelectedFiles(prev => ({
      ...prev,
      [industryId]: file
    }));
  };

  const handleUpload = async (industryId: string) => {
    const file = selectedFiles[industryId];
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select an image file first.",
        variant: "destructive"
      });
      return;
    }

    setUploadingIds(prev => new Set(prev).add(industryId));

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('industryId', industryId);

      const response = await fetch('/api/upload-industry-image', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadedUrls(prev => ({
        ...prev,
        [industryId]: data.imageUrl
      }));

      toast({
        title: "Upload successful",
        description: `Image uploaded for ${INDUSTRY_PACKS.find(i => i.id === industryId)?.label}. Update the config file to use: ${data.imageUrl}`
      });

      // Clear the selected file
      setSelectedFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[industryId];
        return newFiles;
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(industryId);
        return newSet;
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Industry Hero Images</h1>
        <p className="text-muted-foreground">
          Upload custom images for each industry. After uploading, copy the URL and update it in{" "}
          <code className="bg-muted px-2 py-0.5 rounded text-sm">
            client/src/config/industryPacks.ts
          </code>
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100">Quick Guide:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>Select an image file for the industry (JPG, PNG, GIF, or WebP)</li>
          <li>Click "Upload" to save the image to the server</li>
          <li>Copy the returned URL from the success message</li>
          <li>Open <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">client/src/config/industryPacks.ts</code></li>
          <li>Find the industry and update its <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">imageUrl</code> field</li>
          <li>The image will appear automatically on the onboarding page</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INDUSTRY_PACKS.map((industry) => {
          const selectedFile = selectedFiles[industry.id];
          const isUploading = uploadingIds.has(industry.id);
          const uploadedUrl = uploadedUrls[industry.id];

          return (
            <Card key={industry.id} data-testid={`industry-upload-${industry.id}`}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{industry.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {industry.category}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Image Preview */}
                {industry.imageUrl && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Current Image:</Label>
                    <div className="relative w-full h-32 rounded-md overflow-hidden border">
                      <img
                        src={industry.imageUrl}
                        alt={industry.imageAlt || industry.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {industry.imageUrl.startsWith('http') && (
                      <a
                        href={industry.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View source
                      </a>
                    )}
                  </div>
                )}

                {/* File Upload */}
                <div className="space-y-2">
                  <Label htmlFor={`file-${industry.id}`}>Upload New Image:</Label>
                  <Input
                    id={`file-${industry.id}`}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => handleFileSelect(industry.id, e.target.files?.[0] || null)}
                    disabled={isUploading}
                    data-testid={`file-input-${industry.id}`}
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                {/* Upload Button */}
                <Button
                  onClick={() => handleUpload(industry.id)}
                  disabled={!selectedFile || isUploading}
                  className="w-full"
                  data-testid={`button-upload-${industry.id}`}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload Image"}
                </Button>

                {/* Uploaded URL Display */}
                {uploadedUrl && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-3 space-y-2">
                    <p className="text-xs font-semibold text-green-900 dark:text-green-100">
                      ✓ Uploaded successfully!
                    </p>
                    <p className="text-xs text-green-800 dark:text-green-200">
                      Update config with this URL:
                    </p>
                    <code className="block text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded break-all">
                      imageUrl: "{uploadedUrl}"
                    </code>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
