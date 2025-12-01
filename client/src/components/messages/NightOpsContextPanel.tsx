import { useState } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Car,
  FileText,
  Star,
  Crown,
  RefreshCw,
  Sparkles,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Edit3,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  lifetimeValue?: number;
}

interface NightOpsContextPanelProps {
  customerInfo: CustomerInfo | null;
  isLoading?: boolean;
  onBookAppointment?: () => void;
  onSaveNotes?: (notes: string) => void;
}

function SectionCard({ 
  children, 
  title, 
  icon: Icon,
  collapsible = false,
  defaultOpen = true 
}: { 
  children: React.ReactNode; 
  title: string; 
  icon: React.ComponentType<{ className?: string }>;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <div className="nightops-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-cyan-400" />
          <span className="nightops-section-title">{title}</span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="nightops-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-cyan-400" />
              <span className="nightops-section-title">{title}</span>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function NightOpsContextPanel({
  customerInfo,
  isLoading = false,
  onBookAppointment,
  onSaveNotes
}: NightOpsContextPanelProps) {
  const [activeTab, setActiveTab] = useState('customer');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(customerInfo?.notes || '');

  const getInitials = (name: string | null, phone: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return phone.slice(-2);
  };

  const handleSaveNotes = () => {
    if (onSaveNotes) {
      onSaveNotes(editedNotes);
    }
    setIsEditingNotes(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="context-panel-loading">
        <div className="nightops-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-slate-700/60 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-700/60 rounded animate-pulse" />
              <div className="h-3 w-24 bg-slate-700/60 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-700/60 rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-slate-700/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="nightops-card p-4">
          <div className="h-4 w-20 bg-slate-700/60 rounded animate-pulse mb-3" />
          <div className="h-16 w-full bg-slate-700/60 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!customerInfo) {
    return (
      <div 
        className="flex flex-col items-center justify-center h-64 text-center p-6"
        data-testid="night-ops-context-panel"
      >
        <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-4 ring-1 ring-slate-700/60">
          <User className="h-8 w-8 text-slate-600" />
        </div>
        <h3 className="text-sm font-medium text-slate-300 mb-1">
          No conversation selected
        </h3>
        <p className="text-xs text-slate-500">
          Select a conversation to view customer details
        </p>
      </div>
    );
  }

  const isVIP = (customerInfo.totalBookings ?? 0) >= 5;
  const isReturning = (customerInfo.totalBookings ?? 0) >= 2;
  const hasVehicles = customerInfo.vehicles && customerInfo.vehicles.length > 0;

  return (
    <div className="space-y-3 text-xs text-slate-200" data-testid="night-ops-context-panel">
      <div className="nightops-card p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className={cn(
            "nightops-avatar w-12 h-12 text-base",
            isVIP && "ring-2 ring-amber-400/60"
          )}>
            {getInitials(customerInfo.name, customerInfo.phone)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-slate-100 truncate">
              {customerInfo.name || 'Unknown Customer'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isVIP && (
                <span className="inline-flex items-center gap-1 nightops-badge text-amber-300 bg-amber-500/15 border-amber-500/40">
                  <Crown className="h-2.5 w-2.5" />
                  VIP
                </span>
              )}
              {isReturning && !isVIP && (
                <span className="inline-flex items-center gap-1 nightops-badge nightops-badge-success">
                  <RefreshCw className="h-2.5 w-2.5" />
                  Returning
                </span>
              )}
              {!isReturning && (
                <span className="inline-flex items-center gap-1 nightops-badge">
                  <Sparkles className="h-2.5 w-2.5" />
                  New
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-300">
            <Phone className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
            <span className="truncate font-mono text-xs">{customerInfo.phone}</span>
          </div>

          {customerInfo.email && (
            <div className="flex items-center gap-2 text-slate-300">
              <Mail className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
              <span className="truncate">{customerInfo.email}</span>
            </div>
          )}

          {customerInfo.address && (
            <div className="flex items-start gap-2 text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span className="leading-tight">{customerInfo.address}</span>
            </div>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-slate-800/60 border border-slate-700/40 p-1 rounded-lg">
          <TabsTrigger 
            value="customer" 
            className="flex-1 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
          >
            Stats
          </TabsTrigger>
          {hasVehicles && (
            <TabsTrigger 
              value="vehicles" 
              className="flex-1 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
            >
              Vehicles
            </TabsTrigger>
          )}
          <TabsTrigger 
            value="notes" 
            className="flex-1 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
          >
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customer" className="mt-3 space-y-3">
          {(customerInfo.totalBookings !== undefined || customerInfo.loyaltyPoints !== undefined) && (
            <div className="nightops-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-cyan-400" />
                <span className="nightops-section-title">Customer Stats</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {customerInfo.totalBookings !== undefined && (
                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-center">
                    <div className="text-lg font-bold text-cyan-300">{customerInfo.totalBookings}</div>
                    <div className="text-[0.65rem] text-slate-400 uppercase tracking-wide">Bookings</div>
                  </div>
                )}
                {customerInfo.loyaltyPoints !== undefined && (
                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-center">
                    <div className="text-lg font-bold text-purple-300">{customerInfo.loyaltyPoints}</div>
                    <div className="text-[0.65rem] text-slate-400 uppercase tracking-wide">Points</div>
                  </div>
                )}
                {customerInfo.lifetimeValue !== undefined && (
                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-center col-span-2">
                    <div className="text-lg font-bold text-green-300">${customerInfo.lifetimeValue.toFixed(0)}</div>
                    <div className="text-[0.65rem] text-slate-400 uppercase tracking-wide">Lifetime Value</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {customerInfo.lastBooking && (
            <div className="nightops-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-cyan-400" />
                <span className="nightops-section-title">Last Booking</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40">
                <p className="font-medium text-slate-100">
                  {customerInfo.lastBooking.service}
                </p>
                <p className="text-[0.65rem] text-slate-400 mt-1">
                  {new Date(customerInfo.lastBooking.date).toLocaleDateString()}
                </p>
                <span className={cn(
                  "inline-block mt-2 nightops-badge",
                  customerInfo.lastBooking.status === 'completed' && "nightops-badge-success",
                  customerInfo.lastBooking.status === 'cancelled' && "nightops-badge-danger"
                )}>
                  {customerInfo.lastBooking.status}
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        {hasVehicles && (
          <TabsContent value="vehicles" className="mt-3">
            <div className="nightops-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Car className="h-4 w-4 text-cyan-400" />
                <span className="nightops-section-title">Vehicles ({customerInfo.vehicles?.length})</span>
              </div>
              <div className="space-y-2">
                {customerInfo.vehicles?.map((vehicle, index) => (
                  <div
                    key={index}
                    className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40"
                  >
                    <p className="font-medium text-slate-100">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    {vehicle.color && (
                      <p className="text-[0.65rem] text-slate-400 mt-0.5">
                        Color: {vehicle.color}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="notes" className="mt-3">
          <div className="nightops-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" />
                <span className="nightops-section-title">Notes</span>
              </div>
              {!isEditingNotes ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditedNotes(customerInfo.notes || '');
                    setIsEditingNotes(true);
                  }}
                  className="h-6 px-2 text-xs text-slate-400 hover:text-cyan-300"
                  data-testid="button-edit-notes"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveNotes}
                  className="h-6 px-2 text-xs text-cyan-400 hover:text-cyan-300"
                  data-testid="button-save-notes"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              )}
            </div>
            {isEditingNotes ? (
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Add notes about this customer..."
                className="min-h-[100px] nightops-input bg-slate-900/60 border-slate-700/60 text-slate-200 placeholder:text-slate-500 text-xs"
                data-testid="textarea-notes"
              />
            ) : (
              <div className="min-h-[60px]">
                {customerInfo.notes ? (
                  <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {customerInfo.notes}
                  </p>
                ) : (
                  <p className="text-slate-500 italic">No notes yet</p>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="pt-2">
        <Button
          onClick={onBookAppointment}
          disabled={!onBookAppointment}
          className="w-full nightops-button-primary text-sm font-medium py-2.5"
          data-testid="button-book-appointment"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Book Appointment
        </Button>
      </div>
    </div>
  );
}
