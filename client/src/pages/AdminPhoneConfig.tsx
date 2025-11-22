/**
 * Phase 2.5: Admin Phone Config UI
 * 
 * Manage tenant phone configurations and IVR modes
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogFooter, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Phone, Shield, Menu, Bot, Edit, Trash2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface PhoneConfig {
  id: string;
  tenantId: string;
  phoneNumber: string;
  ivrMode: 'simple' | 'ivr' | 'ai-voice';
  sipDomain: string | null;
  sipUsername: string | null;
  messagingServiceSid: string | null;
  createdAt: string;
  tenantName: string | null;
  isRoot: boolean | null;
}

export default function AdminPhoneConfig() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<PhoneConfig | null>(null);
  
  const [createForm, setCreateForm] = useState({ 
    tenantId: "", 
    phoneNumber: "", 
    ivrMode: "simple" as const,
    sipDomain: "",
    sipUsername: "",
  });

  const [editForm, setEditForm] = useState<{
    ivrMode?: 'simple' | 'ivr' | 'ai-voice';
    sipDomain?: string;
    sipUsername?: string;
  }>({});

  // Fetch all phone configs
  const { data, isLoading } = useQuery<{ success: boolean; configs: PhoneConfig[] }>({
    queryKey: ["/api/admin/phone-config"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/phone-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      setCreateDialogOpen(false);
      setCreateForm({ tenantId: "", phoneNumber: "", ivrMode: "simple", sipDomain: "", sipUsername: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-config"] });
      toast({
        title: "Phone config created",
        description: "Successfully added new phone configuration",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: error.message,
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/admin/phone-config/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      setEditDialogOpen(false);
      setSelectedConfig(null);
      setEditForm({});
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-config"] });
      toast({
        title: "Phone config updated",
        description: "Successfully updated phone configuration",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/phone-config/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-config"] });
      toast({
        title: "Phone config deleted",
        description: "Successfully removed phone configuration",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: error.message,
      });
    }
  });

  const handleEdit = (config: PhoneConfig) => {
    setSelectedConfig(config);
    setEditForm({
      ivrMode: config.ivrMode,
      sipDomain: config.sipDomain || "",
      sipUsername: config.sipUsername || "",
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (config: PhoneConfig) => {
    if (confirm(`Delete phone config for ${config.phoneNumber}?`)) {
      deleteMutation.mutate(config.id);
    }
  };

  const getIvrModeIcon = (mode: string) => {
    switch (mode) {
      case 'simple': return <Phone className="h-4 w-4" />;
      case 'ivr': return <Menu className="h-4 w-4" />;
      case 'ai-voice': return <Bot className="h-4 w-4" />;
      default: return <Phone className="h-4 w-4" />;
    }
  };

  const getIvrModeBadge = (mode: string) => {
    switch (mode) {
      case 'simple': return <Badge variant="secondary">Simple Forward</Badge>;
      case 'ivr': return <Badge variant="default">IVR Menu</Badge>;
      case 'ai-voice': return <Badge variant="outline">AI Voice (Future)</Badge>;
      default: return <Badge variant="secondary">{mode}</Badge>;
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Phone & IVR Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage phone configurations and IVR modes for all tenants
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-phone-config">
          <Phone className="mr-2 h-4 w-4" />
          Add Phone Config
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : !data?.configs.length ? (
        <Card className="p-12 text-center">
          <Phone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No phone configurations yet</h3>
          <p className="text-muted-foreground mb-4">
            Add a phone configuration to enable calling and IVR for a tenant
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            Add First Config
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.configs.map((config) => (
            <Card key={config.id} className="p-6" data-testid={`card-phone-config-${config.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getIvrModeIcon(config.ivrMode)}
                  <div>
                    <div className="font-bold text-lg flex items-center gap-2">
                      {config.tenantName || config.tenantId}
                      {config.isRoot && (
                        <Shield className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {config.phoneNumber}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Mode</div>
                  {getIvrModeBadge(config.ivrMode)}
                </div>

                {config.sipDomain && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">SIP Domain</div>
                    <div className="text-sm font-mono">{config.sipDomain}</div>
                  </div>
                )}

                {config.sipUsername && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">SIP Username</div>
                    <div className="text-sm font-mono">{config.sipUsername}</div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleEdit(config)}
                  data-testid={`button-edit-${config.id}`}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                {!config.isRoot && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => handleDelete(config)}
                    data-testid={`button-delete-${config.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Phone Configuration</DialogTitle>
            <DialogDescription>
              Configure a phone number and IVR mode for a tenant
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="tenantId">Tenant ID</Label>
              <Input
                id="tenantId"
                placeholder="root"
                value={createForm.tenantId}
                onChange={(e) => setCreateForm({ ...createForm, tenantId: e.target.value })}
                data-testid="input-tenant-id"
              />
            </div>

            <div>
              <Label htmlFor="phoneNumber">Phone Number (E.164 format)</Label>
              <Input
                id="phoneNumber"
                placeholder="+19185551234"
                value={createForm.phoneNumber}
                onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                data-testid="input-phone-number"
              />
            </div>

            <div>
              <Label htmlFor="ivrMode">IVR Mode</Label>
              <Select
                value={createForm.ivrMode}
                onValueChange={(v: 'simple' | 'ivr' | 'ai-voice') => 
                  setCreateForm({ ...createForm, ivrMode: v })
                }
              >
                <SelectTrigger data-testid="select-ivr-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple (Direct Forward)</SelectItem>
                  <SelectItem value="ivr">IVR (Press 1/2/3/7 Menu)</SelectItem>
                  <SelectItem value="ai-voice">AI Voice (Future)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sipDomain">SIP Domain (Optional)</Label>
              <Input
                id="sipDomain"
                placeholder="example.sip.twilio.com"
                value={createForm.sipDomain}
                onChange={(e) => setCreateForm({ ...createForm, sipDomain: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="sipUsername">SIP Username (Optional)</Label>
              <Input
                id="sipUsername"
                placeholder="username"
                value={createForm.sipUsername}
                onChange={(e) => setCreateForm({ ...createForm, sipUsername: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-save-create"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Phone Configuration</DialogTitle>
            <DialogDescription>
              Update IVR mode and SIP settings for {selectedConfig?.phoneNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-ivrMode">IVR Mode</Label>
              <Select
                value={editForm.ivrMode}
                onValueChange={(v: 'simple' | 'ivr' | 'ai-voice') => 
                  setEditForm({ ...editForm, ivrMode: v })
                }
              >
                <SelectTrigger data-testid="select-edit-ivr-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple (Direct Forward)</SelectItem>
                  <SelectItem value="ivr">IVR (Press 1/2/3/7 Menu)</SelectItem>
                  <SelectItem value="ai-voice">AI Voice (Future)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-sipDomain">SIP Domain</Label>
              <Input
                id="edit-sipDomain"
                placeholder="example.sip.twilio.com"
                value={editForm.sipDomain || ""}
                onChange={(e) => setEditForm({ ...editForm, sipDomain: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-sipUsername">SIP Username</Label>
              <Input
                id="edit-sipUsername"
                placeholder="username"
                value={editForm.sipUsername || ""}
                onChange={(e) => setEditForm({ ...editForm, sipUsername: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => updateMutation.mutate({ 
                id: selectedConfig!.id, 
                data: editForm 
              })}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
