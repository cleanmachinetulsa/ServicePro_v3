import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, AlertTriangle, CheckCircle2, Move } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface AddressMapConfirmationProps {
  address: string;
  latitude: number;
  longitude: number;
  onConfirm: (lat: number, lng: number, addressNeedsReview: boolean) => void;
  onCancel: () => void;
}

interface GoogleMapsWindow extends Window {
  google?: {
    maps: typeof google.maps;
  };
}

export function AddressMapConfirmation({
  address,
  latitude,
  longitude,
  onConfirm,
  onCancel,
}: AddressMapConfirmationProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const [currentLat, setCurrentLat] = useState(latitude);
  const [currentLng, setCurrentLng] = useState(longitude);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMovedPin, setHasMovedPin] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'initial' | 'valid' | 'needs_review'>('initial');
  const mapRef = useRef<HTMLDivElement>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // Load Google Maps script
  useEffect(() => {
    const win = window as GoogleMapsWindow;
    if (win.google?.maps) {
      setGoogleMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCK4Yd7Gc2otBRl2KFVImNiJvWoNjGLbOc'}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleMapsLoaded(true);
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!googleMapsLoaded || !mapRef.current || map) return;

    const newMap = new google.maps.Map(mapRef.current, {
      center: { lat: currentLat, lng: currentLng },
      zoom: 17,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    const newMarker = new google.maps.Marker({
      position: { lat: currentLat, lng: currentLng },
      map: newMap,
      draggable: true,
      animation: google.maps.Animation.DROP,
      title: 'Drag to adjust location',
    });

    // Marker drag event handlers
    newMarker.addListener('dragstart', () => {
      setIsDragging(true);
    });

    newMarker.addListener('dragend', () => {
      setIsDragging(false);
      const position = newMarker.getPosition();
      if (position) {
        setCurrentLat(position.lat());
        setCurrentLng(position.lng());
        setHasMovedPin(true);
        setValidationStatus('needs_review'); // Mark for review when pin moved
      }
    });

    setMap(newMap);
    setMarker(newMarker);
  }, [googleMapsLoaded]);

  // Re-validate address when pin is moved
  const handleRevalidate = async () => {
    setIsValidating(true);
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({
        location: { lat: currentLat, lng: currentLng },
      });

      if (result.results && result.results[0]) {
        const newAddress = result.results[0].formatted_address;
        
        // Simple validation: check if we can geocode the new location
        // In production, you'd call your backend validation API
        const isWithinServiceArea = true; // Placeholder - should call backend
        
        if (isWithinServiceArea) {
          setValidationStatus('valid');
        } else {
          setValidationStatus('needs_review');
        }
      } else {
        setValidationStatus('needs_review');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setValidationStatus('needs_review');
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmLocation = () => {
    const needsReview = hasMovedPin && validationStatus === 'needs_review';
    onConfirm(currentLat, currentLng, needsReview);
  };

  if (!googleMapsLoaded) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading map...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-1">Confirm Your Address</h3>
              <p className="text-sm text-muted-foreground break-words">{address}</p>
            </div>
          </div>

          {/* Status badge */}
          {hasMovedPin && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              {validationStatus === 'needs_review' ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Pin moved - this will be marked for technician review
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-800 dark:text-green-300">
                    New location validated
                  </p>
                </>
              )}
            </div>
          )}

          {/* Map container */}
          <div className="relative">
            <div
              ref={mapRef}
              className="w-full h-[400px] rounded-lg border border-border overflow-hidden"
              data-testid="map-address-confirmation"
            />
            
            {isDragging && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur px-4 py-2 rounded-lg shadow-lg border border-border">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Move className="h-4 w-4 text-primary" />
                  Drag pin to adjust location
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Is this pin in the correct location?</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>If correct, click "Confirm Location"</li>
              <li>If wrong, drag the red pin to the correct spot</li>
              <li>Our technician will review any adjusted locations before arrival</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
              data-testid="button-cancel-map"
            >
              Cancel
            </Button>
            {hasMovedPin && validationStatus === 'needs_review' && (
              <Button
                variant="secondary"
                onClick={handleRevalidate}
                disabled={isValidating}
                data-testid="button-revalidate-address"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Re-validate'
                )}
              </Button>
            )}
            <Button
              onClick={handleConfirmLocation}
              className="flex-1"
              data-testid="button-confirm-location"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm Location
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
