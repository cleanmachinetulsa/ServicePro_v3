import { Download, FileArchive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function DownloadExportPage() {
  const handleDownload = () => {
    window.location.href = '/download/cleanmachine-export.zip';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-full">
            <FileArchive className="h-16 w-16 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Download Export File</h1>
        <p className="text-muted-foreground mb-6">
          Clean Machine Auto Detail Export
        </p>
        
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">File Name:</span>
            <span className="text-muted-foreground">cleanmachine-export.zip</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="font-medium">Size:</span>
            <span className="text-muted-foreground">369 MB</span>
          </div>
        </div>
        
        <Button 
          onClick={handleDownload}
          className="w-full"
          size="lg"
          data-testid="button-download-export"
        >
          <Download className="h-5 w-5 mr-2" />
          Download File
        </Button>
        
        <p className="text-xs text-muted-foreground mt-4">
          Note: This is a large file (369MB). Download may take a few minutes depending on your connection speed.
        </p>
      </Card>
    </div>
  );
}
