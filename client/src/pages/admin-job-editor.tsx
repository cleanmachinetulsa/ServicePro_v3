/**
 * Admin Job Editor
 * 
 * Comprehensive appointment/job management UI with third-party billing capabilities:
 * - Role tiles showing all assigned contacts
 * - Billing configuration and controls
 * - Privacy settings
 * - Activity timeline (audit log)
 * - Quick actions (send approval, create payment link, view history)
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RoleAssignmentWizard, type RoleAssignment } from "@/components/RoleAssignmentWizard";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Phone,
  Car,
  CreditCard,
  Mail,
  Building,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit,
  Send,
  Eye,
  DollarSign,
  FileText,
  Gift,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Contact {
  id: number;
  name: string;
  phone: string;
  phoneE164?: string;
  email?: string;
  company?: string;
  smsOptOut?: boolean;
}

interface Appointment {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  scheduledTime: string;
  serviceType: string;
  estimatedPrice?: number;
  status: string;
  billingType?: 'self' | 'third_party' | 'gift' | 'company_po';
  requesterContactId?: number;
  serviceContactId?: number;
  vehicleOwnerContactId?: number;
  billingContactId?: number;
  sharePriceWithRequester?: boolean;
  shareLocationWithPayer?: boolean;
  isGift?: boolean;
  giftMessage?: string;
  poNumber?: string;
  depositPercent?: number;
  depositAmount?: number;
  depositPaid?: boolean;
  priceLocked?: boolean;
  priceLockedAmount?: number;
}

interface AuditLogEntry {
  id: number;
  actionType: string;
  timestamp: string;
  userId?: number;
  details: Record<string, any>;
}

export default function AdminJobEditor() {
  const params = useParams();
  const appointmentId = parseInt(params.id || '0');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [showRoleEditor, setShowRoleEditor] = useState(false);
  const [roleAssignment, setRoleAssignment] = useState<RoleAssignment>({
    billingType: 'self',
    sharePriceWithRequester: true,
    shareLocationWithPayer: true,
    isGift: false,
  });

  // Fetch appointment details
  const { data: appointmentData, isLoading: loadingAppointment } = useQuery({
    queryKey: ['/api/appointments', appointmentId],
    queryFn: async () => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch appointment');
      return response.json();
    },
    enabled: appointmentId > 0,
  });

  // Fetch role contacts
  const { data: rolesData, isLoading: loadingRoles } = useQuery({
    queryKey: ['/api/appointments', appointmentId, 'roles'],
    queryFn: async () => {
      const response = await fetch(`/api/appointments/${appointmentId}/roles`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch roles');
      return response.json();
    },
    enabled: appointmentId > 0,
  });

  // Fetch audit log
  const { data: auditData } = useQuery<{ history: AuditLogEntry[] }>({
    queryKey: ['/api/audit-log', 'appointment', appointmentId],
    queryFn: async () => {
      const response = await fetch(`/api/audit-log/appointment/${appointmentId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch audit log');
      return response.json();
    },
    enabled: appointmentId > 0,
  });

  // Update roles mutation
  const updateRolesMutation = useMutation({
    mutationFn: async (assignment: RoleAssignment) => {
      const response = await apiRequest('POST', `/api/appointments/${appointmentId}/assign-roles`, {
        requesterContactId: assignment.requester?.id,
        serviceContactId: assignment.serviceContact?.id,
        vehicleOwnerContactId: assignment.vehicleOwner?.id,
        billingContactId: assignment.payer?.id,
        billingType: assignment.billingType,
        sharePriceWithRequester: assignment.sharePriceWithRequester,
        shareLocationWithPayer: assignment.shareLocationWithPayer,
        isGift: assignment.isGift,
        giftMessage: assignment.giftMessage,
        poNumber: assignment.poNumber,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments', appointmentId], exact: false });
      setShowRoleEditor(false);
      toast({
        title: "Roles updated",
        description: "Contact roles have been successfully updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating roles",
        description: error.message || "Failed to update roles",
        variant: "destructive",
      });
    },
  });

  const appointment: Appointment | undefined = appointmentData?.appointment || appointmentData;
  const roles = rolesData?.roles || {};

  // Initialize role assignment from fetched data
  const handleOpenRoleEditor = () => {
    setRoleAssignment({
      requester: roles.requester || null,
      serviceContact: roles.serviceContact || null,
      vehicleOwner: roles.vehicleOwner || null,
      payer: roles.billing || null,
      billingType: appointment?.billingType || 'self',
      sharePriceWithRequester: appointment?.sharePriceWithRequester ?? true,
      shareLocationWithPayer: appointment?.shareLocationWithPayer ?? true,
      isGift: appointment?.isGift ?? false,
      giftMessage: appointment?.giftMessage,
      poNumber: appointment?.poNumber,
    });
    setShowRoleEditor(true);
  };

  const handleSaveRoles = () => {
    updateRolesMutation.mutate(roleAssignment);
  };

  if (loadingAppointment || loadingRoles) {
    return (
      <AppShell title="Job Editor">
        <div className="p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading appointment...</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!appointment) {
    return (
      <AppShell title="Job Editor">
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Appointment not found. Please check the ID and try again.
            </AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const pageActions = (
    <>
      <Badge
        variant={appointment.status === 'confirmed' ? 'default' : 'secondary'}
        className="text-sm"
      >
        {appointment.status}
      </Badge>
      {appointment.priceLocked && (
        <Badge variant="outline" className="text-sm">
          <DollarSign className="h-3 w-3 mr-1" />
          Price Locked
        </Badge>
      )}
      {appointment.isGift && (
        <Badge variant="outline" className="text-sm bg-pink-50 text-pink-700 border-pink-200">
          <Gift className="h-3 w-3 mr-1" />
          Gift
        </Badge>
      )}
    </>
  );

  return (
    <AppShell title={`Job Editor - Appointment #${appointmentId}`} pageActions={pageActions}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Appointment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-medium">{appointment.serviceType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="font-medium">
                    {new Date(appointment.scheduledTime).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Price</p>
                  <p className="font-medium">
                    ${appointment.estimatedPrice?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Billing Type</p>
                  <Badge variant="outline">{appointment.billingType || 'self'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role Tiles */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Contact Roles</CardTitle>
                <CardDescription>People involved in this appointment</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenRoleEditor}
                data-testid="button-edit-roles"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Roles
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Service Contact */}
                <RoleTile
                  icon={<Phone className="h-5 w-5" />}
                  title="Service Contact"
                  subtitle="Present during service"
                  contact={roles.serviceContact}
                  required
                />

                {/* Payer */}
                <RoleTile
                  icon={<CreditCard className="h-5 w-5" />}
                  title="Payer"
                  subtitle="Responsible for payment"
                  contact={roles.billing}
                  required
                  badge={appointment.depositPaid ? { text: 'Deposit Paid', variant: 'default' } : undefined}
                />

                {/* Requester (optional) */}
                {roles.requester && (
                  <RoleTile
                    icon={<User className="h-5 w-5" />}
                    title="Requester"
                    subtitle="Scheduled the appointment"
                    contact={roles.requester}
                  />
                )}

                {/* Vehicle Owner (optional) */}
                {roles.vehicleOwner && (
                  <RoleTile
                    icon={<Car className="h-5 w-5" />}
                    title="Vehicle Owner"
                    subtitle="Owns the vehicle"
                    contact={roles.vehicleOwner}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Billing Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Billing Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={appointment.sharePriceWithRequester ? 'text-green-600' : 'text-muted-foreground'}>
                    <Eye className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Share Price with Requester</p>
                    <p className="text-xs text-muted-foreground">
                      {appointment.sharePriceWithRequester ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={appointment.shareLocationWithPayer ? 'text-green-600' : 'text-muted-foreground'}>
                    <Eye className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Share Location with Payer</p>
                    <p className="text-xs text-muted-foreground">
                      {appointment.shareLocationWithPayer ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>

                {appointment.depositPercent && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="text-blue-600">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Deposit Required</p>
                      <p className="text-xs text-muted-foreground">
                        {appointment.depositPercent}% (${appointment.depositAmount?.toFixed(2) || '0.00'})
                      </p>
                    </div>
                    {appointment.depositPaid && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                )}

                {appointment.poNumber && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="text-purple-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Purchase Order</p>
                      <p className="text-xs text-muted-foreground">{appointment.poNumber}</p>
                    </div>
                  </div>
                )}
              </div>

              {appointment.isGift && appointment.giftMessage && (
                <div className="p-4 bg-pink-50 border border-pink-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Gift className="h-5 w-5 text-pink-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-pink-900">Gift Message</p>
                      <p className="text-sm text-pink-700 mt-1">{appointment.giftMessage}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" data-testid="button-send-approval">
                <Send className="h-4 w-4 mr-2" />
                Send Payer Approval
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-create-payment-link">
                <CreditCard className="h-4 w-4 mr-2" />
                Create Payment Link
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-view-history">
                <Clock className="h-4 w-4 mr-2" />
                View Full History
              </Button>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Last 10 actions</CardDescription>
            </CardHeader>
            <CardContent>
              {auditData?.history && auditData.history.length > 0 ? (
                <div className="space-y-4">
                  {auditData.history.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{formatActionType(entry.actionType)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity recorded yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Role Editor Dialog */}
      <Dialog open={showRoleEditor} onOpenChange={setShowRoleEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact Roles</DialogTitle>
            <DialogDescription>
              Assign contacts to different roles and configure billing settings
            </DialogDescription>
          </DialogHeader>

          <RoleAssignmentWizard
            value={roleAssignment}
            onChange={setRoleAssignment}
          />

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowRoleEditor(false)}
              data-testid="button-cancel-role-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRoles}
              disabled={updateRolesMutation.isPending || !roleAssignment.serviceContact || !roleAssignment.payer}
              data-testid="button-save-roles"
            >
              {updateRolesMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </AppShell>
  );
}

// Helper component for role tiles
function RoleTile({
  icon,
  title,
  subtitle,
  contact,
  required = false,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  contact?: Contact | null;
  required?: boolean;
  badge?: { text: string; variant: 'default' | 'secondary' | 'outline' };
}) {
  return (
    <div className="p-4 border rounded-lg bg-card" data-testid={`role-tile-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <div>
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {required && !contact && (
          <Badge variant="destructive" className="text-xs">Required</Badge>
        )}
        {badge && (
          <Badge variant={badge.variant} className="text-xs">{badge.text}</Badge>
        )}
      </div>

      {contact ? (
        <div className="space-y-1">
          <p className="font-medium">{contact.name}</p>
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{contact.phone}</span>
            </div>
            {contact.email && (
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-1">
                <Building className="h-3 w-3" />
                <span className="truncate">{contact.company}</span>
              </div>
            )}
          </div>
          {contact.smsOptOut && (
            <Badge variant="destructive" className="text-xs mt-2">SMS Opted Out</Badge>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">Not assigned</p>
      )}
    </div>
  );
}

// Helper function to format action types
function formatActionType(actionType: string): string {
  const formatted = actionType
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return formatted;
}
