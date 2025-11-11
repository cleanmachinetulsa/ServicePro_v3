import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, ExternalLink, Map } from 'lucide-react';
import { useTechnician } from '@/contexts/TechnicianContext';

export function NavigationPod() {
  const { selectedJob } = useTechnician();

  if (!selectedJob) {
    return (
      <Card className="h-full bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-blue-300 text-sm">Select a job to view navigation</p>
        </CardContent>
      </Card>
    );
  }

  const hasAddress = !!selectedJob.customerAddress;
  const hasCoordinates = !!(selectedJob.latitude && selectedJob.longitude);
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const openAppleMaps = () => {
    if (hasCoordinates) {
      window.open(`http://maps.apple.com/?ll=${selectedJob.latitude},${selectedJob.longitude}`, '_blank');
    } else if (hasAddress) {
      window.open(`http://maps.apple.com/?address=${encodeURIComponent(selectedJob.customerAddress)}`, '_blank');
    }
  };

  const openGoogleMaps = () => {
    if (hasCoordinates) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedJob.latitude},${selectedJob.longitude}`, '_blank');
    } else if (hasAddress) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedJob.customerAddress)}`, '_blank');
    }
  };

  return (
    <Card className="h-full flex flex-col bg-white/5 border-white/10">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Navigation className="w-5 h-5" />
          Navigation
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Address Display */}
        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-200 mb-1">Customer Address</h3>
              <p className="text-white text-sm">
                {selectedJob.customerAddress || 'No address available'}
              </p>
              {hasCoordinates && (
                <p className="text-xs text-blue-300 mt-2">
                  {parseFloat(selectedJob.latitude!).toFixed(6)}, {parseFloat(selectedJob.longitude!).toFixed(6)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Map Preview */}
        {hasAddress && mapsApiKey ? (
          <div className="bg-white/5 rounded-lg overflow-hidden border border-white/10">
            <iframe
              width="100%"
              height="250"
              frameBorder="0"
              style={{ border: 0 }}
              src={`https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${encodeURIComponent(selectedJob.customerAddress)}`}
              allowFullScreen
              title="Location Map"
              className="w-full"
            />
          </div>
        ) : (
          <div className="bg-white/5 rounded-lg border-2 border-dashed border-white/20 p-8 flex flex-col items-center justify-center text-center">
            <Map className="w-12 h-12 text-blue-400 mb-3" />
            <p className="text-blue-300 text-sm">
              {hasAddress ? 'Map preview unavailable' : 'No address for map preview'}
            </p>
            <p className="text-blue-400 text-xs mt-1">
              Use navigation buttons below
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        {hasAddress && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-blue-200">Open in Navigation App</h3>
            
            <Button
              onClick={openAppleMaps}
              className="w-full justify-start bg-white/10 hover:bg-white/20 text-white border border-white/20"
              data-testid="button-apple-maps"
            >
              <ExternalLink className="w-4 h-4 mr-3" />
              Open in Apple Maps
            </Button>

            <Button
              onClick={openGoogleMaps}
              className="w-full justify-start bg-white/10 hover:bg-white/20 text-white border border-white/20"
              data-testid="button-google-maps"
            >
              <ExternalLink className="w-4 h-4 mr-3" />
              Open in Google Maps
            </Button>
          </div>
        )}

        {/* ETA/Distance Placeholder */}
        <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-300">Estimated Drive Time</p>
              <p className="text-lg font-bold text-white">15 min</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-300">Distance</p>
              <p className="text-lg font-bold text-white">5.2 mi</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
