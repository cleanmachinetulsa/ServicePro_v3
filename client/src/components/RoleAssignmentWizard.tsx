/**
 * Role Assignment Wizard
 * 
 * Multi-role contact assignment UI for appointments with:
 * - Smart auto-fill (same person for multiple roles)
 * - Privacy controls
 * - Billing type selection
 * - Gift mode toggle
 */

import { useState } from "react";
import { ContactPicker, type Contact } from "./ContactPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Phone,
  Car,
  CreditCard,
  Gift,
  Building,
  Eye,
  EyeOff,
  Info,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RoleAssignment {
  requester?: Contact | null;
  serviceContact?: Contact | null;
  vehicleOwner?: Contact | null;
  payer?: Contact | null;
  billingType: 'self' | 'third_party' | 'gift' | 'company_po';
  sharePriceWithRequester: boolean;
  shareLocationWithPayer: boolean;
  isGift: boolean;
  giftMessage?: string;
  poNumber?: string;
}

interface RoleAssignmentWizardProps {
  value: RoleAssignment;
  onChange: (assignment: RoleAssignment) => void;
  className?: string;
}

export function RoleAssignmentWizard({
  value,
  onChange,
  className,
}: RoleAssignmentWizardProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['basic']);

  const handleRoleChange = (role: keyof RoleAssignment, contact: Contact | null) => {
    onChange({ ...value, [role]: contact });
  };

  const handleBillingTypeChange = (type: RoleAssignment['billingType']) => {
    const updates: Partial<RoleAssignment> = { billingType: type };

    // Auto-configure based on billing type
    if (type === 'self') {
      // Self-pay: payer is same as service contact
      updates.payer = value.serviceContact;
      updates.sharePriceWithRequester = true;
      updates.shareLocationWithPayer = true;
      updates.isGift = false;
    } else if (type === 'gift') {
      // Gift mode: hide price from recipient, no location sharing
      updates.isGift = true;
      updates.sharePriceWithRequester = false;
      updates.shareLocationWithPayer = false;
    } else if (type === 'company_po') {
      // Company PO: share everything for business transparency
      updates.sharePriceWithRequester = true;
      updates.shareLocationWithPayer = true;
      updates.isGift = false;
    } else {
      // Third-party: default privacy settings
      updates.sharePriceWithRequester = false;
      updates.shareLocationWithPayer = false;
      updates.isGift = false;
    }

    onChange({ ...value, ...updates });
  };

  const handleQuickFill = () => {
    // Same person for all roles
    const contact = value.requester || value.serviceContact;
    if (contact) {
      onChange({
        ...value,
        requester: contact,
        serviceContact: contact,
        vehicleOwner: contact,
        payer: contact,
        billingType: 'self',
        sharePriceWithRequester: true,
        shareLocationWithPayer: true,
      });
    }
  };

  const getRoleCompletionStatus = () => {
    const required = {
      serviceContact: !!value.serviceContact,
      payer: !!value.payer,
    };
    const optional = {
      requester: !!value.requester,
      vehicleOwner: !!value.vehicleOwner,
    };
    return { required, optional };
  };

  const status = getRoleCompletionStatus();
  const isComplete = status.required.serviceContact && status.required.payer;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick Fill Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contact Roles</h3>
          <p className="text-sm text-muted-foreground">
            Assign contacts to different roles for this appointment
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleQuickFill}
          data-testid="button-quick-fill-roles"
        >
          <User className="mr-2 h-4 w-4" />
          Quick Fill (Same Person)
        </Button>
      </div>

      <Accordion
        type="multiple"
        value={expandedSections}
        onValueChange={setExpandedSections}
        className="space-y-2"
      >
        {/* Basic Roles */}
        <AccordionItem value="basic">
          <AccordionTrigger data-testid="trigger-basic-roles">
            <div className="flex items-center gap-2">
              <span>Basic Roles</span>
              {isComplete && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Service Contact */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <Label>Service Contact *</Label>
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Person who will be present during service and receive status updates
                  </p>
                  <ContactPicker
                    value={value.serviceContact || null}
                    onChange={(contact) => handleRoleChange('serviceContact', contact)}
                    placeholder="Select service contact..."
                    suggestedRoles={['Service Contact']}
                  />
                </div>

                <Separator />

                {/* Requester */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <Label>Requester (optional)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Person who requested/scheduled the service (if different from service contact)
                  </p>
                  <ContactPicker
                    value={value.requester || null}
                    onChange={(contact) => handleRoleChange('requester', contact)}
                    placeholder="Select requester (or leave blank)..."
                    suggestedRoles={['Requester']}
                  />
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Billing Configuration */}
        <AccordionItem value="billing">
          <AccordionTrigger data-testid="trigger-billing-config">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span>Billing Configuration</span>
              {value.payer && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Billing Type */}
                <div className="space-y-3">
                  <Label>Billing Type *</Label>
                  <RadioGroup
                    value={value.billingType}
                    onValueChange={(v) => handleBillingTypeChange(v as RoleAssignment['billingType'])}
                    data-testid="radio-group-billing-type"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="self" id="self" data-testid="radio-billing-self" />
                      <Label htmlFor="self" className="font-normal flex-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Self-Pay</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Service contact pays for themselves
                        </p>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="third_party" id="third_party" data-testid="radio-billing-third-party" />
                      <Label htmlFor="third_party" className="font-normal flex-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          <span>Third-Party Billing</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Someone else pays (parent, employer, etc.)
                        </p>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="gift" id="gift" data-testid="radio-billing-gift" />
                      <Label htmlFor="gift" className="font-normal flex-1">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4" />
                          <span>Gift</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Gift service - price hidden from recipient
                        </p>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="company_po" id="company_po" data-testid="radio-billing-company-po" />
                      <Label htmlFor="company_po" className="font-normal flex-1">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          <span>Company Purchase Order</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Corporate/fleet account with net payment terms
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* Payer Contact */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <Label>Payer *</Label>
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Person or company responsible for payment
                  </p>
                  <ContactPicker
                    value={value.payer || null}
                    onChange={(contact) => handleRoleChange('payer', contact)}
                    placeholder="Select payer..."
                    suggestedRoles={['Payer', value.billingType === 'company_po' ? 'Company' : '']}
                  />
                </div>

                {/* Company PO Number */}
                {value.billingType === 'company_po' && (
                  <div className="space-y-2">
                    <Label htmlFor="po-number">Purchase Order Number</Label>
                    <Input
                      id="po-number"
                      value={value.poNumber || ''}
                      onChange={(e) => onChange({ ...value, poNumber: e.target.value })}
                      placeholder="PO-2025-001"
                      data-testid="input-po-number"
                    />
                  </div>
                )}

                {/* Gift Message */}
                {value.isGift && (
                  <div className="space-y-2">
                    <Label htmlFor="gift-message">Gift Message (optional)</Label>
                    <Textarea
                      id="gift-message"
                      value={value.giftMessage || ''}
                      onChange={(e) => onChange({ ...value, giftMessage: e.target.value })}
                      placeholder="Happy Birthday! Enjoy your car detail..."
                      rows={3}
                      data-testid="input-gift-message"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Advanced Options */}
        <AccordionItem value="advanced">
          <AccordionTrigger data-testid="trigger-advanced-options">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span>Advanced Options</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Vehicle Owner */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    <Label>Vehicle Owner (optional)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If vehicle owner is different from service contact (e.g., fleet manager, parent's car)
                  </p>
                  <ContactPicker
                    value={value.vehicleOwner || null}
                    onChange={(contact) => handleRoleChange('vehicleOwner', contact)}
                    placeholder="Select vehicle owner (or leave blank)..."
                    suggestedRoles={['Vehicle Owner']}
                  />
                </div>

                <Separator />

                {/* Privacy Controls */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Privacy Controls</h4>
                    <p className="text-xs text-muted-foreground">
                      Control what information is shared with each role
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 flex-1">
                      <Label className="flex items-center gap-2">
                        {value.sharePriceWithRequester ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                        Share Price with Requester
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Show pricing to the person who requested service
                      </p>
                    </div>
                    <Switch
                      checked={value.sharePriceWithRequester}
                      onCheckedChange={(checked) =>
                        onChange({ ...value, sharePriceWithRequester: checked })
                      }
                      disabled={value.billingType === 'self' || value.isGift}
                      data-testid="switch-share-price"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 flex-1">
                      <Label className="flex items-center gap-2">
                        {value.shareLocationWithPayer ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                        Share Location with Payer
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Show service location and live tracking to payer
                      </p>
                    </div>
                    <Switch
                      checked={value.shareLocationWithPayer}
                      onCheckedChange={(checked) =>
                        onChange({ ...value, shareLocationWithPayer: checked })
                      }
                      disabled={value.billingType === 'self'}
                      data-testid="switch-share-location"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Summary */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Assignment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {value.serviceContact && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="text-muted-foreground">Service Contact:</span>
              <span className="font-medium">{value.serviceContact.name}</span>
            </div>
          )}
          {value.payer && (
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="text-muted-foreground">Payer:</span>
              <span className="font-medium">{value.payer.name}</span>
              <Badge variant="outline" className="text-xs">{value.billingType}</Badge>
            </div>
          )}
          {value.requester && value.requester.id !== value.serviceContact?.id && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-muted-foreground">Requester:</span>
              <span className="font-medium">{value.requester.name}</span>
            </div>
          )}
          {value.vehicleOwner && (
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              <span className="text-muted-foreground">Vehicle Owner:</span>
              <span className="font-medium">{value.vehicleOwner.name}</span>
            </div>
          )}
          {!isComplete && (
            <div className="text-xs text-destructive mt-2">
              * Service Contact and Payer are required
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
