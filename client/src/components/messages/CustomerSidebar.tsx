import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Car,
  FileText,
  Star,
  X
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CustomerInfo {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  vehicles?: Array<{
    year?: string;
    make?: string;
    model?: string;
    color?: string;
  }>;
  notes?: string | null;
  lastBooking?: {
    id: number;
    date: string;
    service: string;
    status: string;
  } | null;
  totalBookings?: number;
  loyaltyPoints?: number;
}

interface CustomerSidebarProps {
  customerInfo: CustomerInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onBookAppointment?: () => void;
  isLoading?: boolean;
}

export function CustomerSidebar({
  customerInfo,
  isOpen,
  onClose,
  onBookAppointment,
  isLoading = false
}: CustomerSidebarProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
          Customer Details
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="md:hidden"
          data-testid="button-close-sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading ? (
            <>
              {/* Loading Skeleton */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="h-16 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </CardContent>
              </Card>
            </>
          ) : !customerInfo ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                No conversation selected
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select a conversation to view customer details
              </p>
            </div>
          ) : (
            <>
              {/* Customer Info Card */}
              <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {customerInfo.name || 'Unknown Customer'}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{customerInfo.phone}</span>
              </div>

              {customerInfo.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{customerInfo.email}</span>
                </div>
              )}

              {customerInfo.address && (
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span className="leading-tight">{customerInfo.address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicles */}
          {customerInfo.vehicles && customerInfo.vehicles.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehicles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {customerInfo.vehicles.map((vehicle, index) => (
                  <div
                    key={index}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                  >
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    {vehicle.color && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Color: {vehicle.color}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {customerInfo.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {customerInfo.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Loyalty & Stats */}
          {(customerInfo.totalBookings !== undefined || customerInfo.loyaltyPoints !== undefined) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Customer Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {customerInfo.totalBookings !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Bookings</span>
                    <Badge variant="secondary">{customerInfo.totalBookings}</Badge>
                  </div>
                )}
                {customerInfo.loyaltyPoints !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Loyalty Points</span>
                    <Badge variant="secondary">{customerInfo.loyaltyPoints}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

              {/* Last Booking */}
              {customerInfo.lastBooking && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Last Booking
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {customerInfo.lastBooking.service}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {new Date(customerInfo.lastBooking.date).toLocaleDateString()}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {customerInfo.lastBooking.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Button
                  className="w-full"
                  onClick={onBookAppointment}
                  disabled={!onBookAppointment}
                  data-testid="button-book-appointment"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Appointment
                </Button>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
