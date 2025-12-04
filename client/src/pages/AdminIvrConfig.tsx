/**
 * IVR Configurator UI
 * 
 * Admin page for configuring the IVR menu for the current tenant.
 * Supports:
 * - Editing greeting text and voice settings
 * - Adding/removing/reordering menu items
 * - Configuring action types and payloads
 * - Resetting to default configuration
 * 
 * Mobile-first design with 393px primary viewport
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Phone, Settings, Plus, Trash2, GripVertical, Save, RotateCcw, Loader2, Volume2, MessageSquare, PhoneForwarded, Voicemail, Hash, EyeOff, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/AppShell';

type IvrActionType = 'PLAY_MESSAGE' | 'SMS_INFO' | 'FORWARD_SIP' | 'FORWARD_PHONE' | 'VOICEMAIL' | 'SUBMENU' | 'REPLAY_MENU' | 'EASTER_EGG';

interface IvrMenuItem {
  id?: number;
  digit: string;
  label: string;
  actionType: IvrActionType;
  actionPayload: Record<string, any>;
  orderIndex: number;
  isHidden: boolean;
}

interface IvrMenu {
  id: number;
  tenantId: string;
  name: string;
  greetingText: string;
  noInputMessage: string;
  invalidInputMessage: string;
  voiceName: string;
  maxAttempts: number;
  isActive: boolean;
  items: IvrMenuItem[];
}

interface ActionTypeInfo {
  type: IvrActionType;
  label: string;
  description: string;
  payloadFields: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

const menuItemSchema = z.object({
  digit: z.string().min(1).max(1),
  label: z.string().min(1).max(100),
  actionType: z.string(),
  actionPayload: z.record(z.any()).optional(),
  orderIndex: z.number(),
  isHidden: z.boolean(),
});

const menuSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  greetingText: z.string().min(1).max(500),
  noInputMessage: z.string().min(1).max(200).optional(),
  invalidInputMessage: z.string().min(1).max(200).optional(),
  voiceName: z.string().optional(),
  maxAttempts: z.number().min(1).max(5).optional(),
  items: z.array(menuItemSchema),
});

type MenuFormData = z.infer<typeof menuSchema>;

const ACTION_TYPE_ICONS: Record<IvrActionType, typeof Phone> = {
  PLAY_MESSAGE: Volume2,
  SMS_INFO: MessageSquare,
  FORWARD_SIP: PhoneForwarded,
  FORWARD_PHONE: Phone,
  VOICEMAIL: Voicemail,
  SUBMENU: Hash,
  REPLAY_MENU: RotateCcw,
  EASTER_EGG: Sparkles,
};

const VOICE_OPTIONS = [
  { value: 'alice', label: 'Alice (US Female)' },
  { value: 'man', label: 'Man (US Male)' },
  { value: 'woman', label: 'Woman (US Female)' },
  { value: 'Polly.Joanna', label: 'Joanna (AWS)' },
  { value: 'Polly.Matthew', label: 'Matthew (AWS)' },
];

const DIGIT_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'];

export default function AdminIvrConfig() {
  const { toast } = useToast();
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [localItems, setLocalItems] = useState<IvrMenuItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: menuData, isLoading } = useQuery<{ success: boolean; menu: IvrMenu }>({
    queryKey: ['/api/admin/ivr/menu'],
  });

  const { data: actionTypesData } = useQuery<{ success: boolean; actionTypes: ActionTypeInfo[] }>({
    queryKey: ['/api/admin/ivr/action-types'],
  });

  const form = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: '',
      greetingText: '',
      noInputMessage: '',
      invalidInputMessage: '',
      voiceName: 'alice',
      maxAttempts: 3,
      items: [],
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MenuFormData) => {
      return await apiRequest('/api/admin/ivr/menu', {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ivr/menu'] });
      setHasChanges(false);
      toast({
        title: 'IVR Menu Updated',
        description: 'Your phone menu settings have been saved.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to save IVR settings.',
        variant: 'destructive',
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/ivr/menu/reset', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ivr/menu'] });
      setHasChanges(false);
      toast({
        title: 'IVR Menu Reset',
        description: 'Your phone menu has been reset to default settings.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to reset IVR settings.',
        variant: 'destructive',
      });
    },
  });

  if (menuData?.menu && localItems.length === 0 && !hasChanges) {
    setLocalItems(menuData.menu.items);
    form.reset({
      name: menuData.menu.name,
      greetingText: menuData.menu.greetingText,
      noInputMessage: menuData.menu.noInputMessage,
      invalidInputMessage: menuData.menu.invalidInputMessage,
      voiceName: menuData.menu.voiceName,
      maxAttempts: menuData.menu.maxAttempts,
      items: menuData.menu.items,
    });
  }

  const handleSave = () => {
    const formValues = form.getValues();
    const dataToSave = {
      ...formValues,
      items: localItems,
    };
    updateMutation.mutate(dataToSave);
  };

  const handleAddItem = () => {
    setEditingItemIndex(null);
    setItemDialogOpen(true);
  };

  const handleEditItem = (index: number) => {
    setEditingItemIndex(index);
    setItemDialogOpen(true);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = localItems.filter((_, i) => i !== index);
    setLocalItems(newItems);
    setHasChanges(true);
  };

  const handleSaveItem = (item: IvrMenuItem) => {
    let newItems: IvrMenuItem[];
    if (editingItemIndex !== null) {
      newItems = [...localItems];
      newItems[editingItemIndex] = item;
    } else {
      newItems = [...localItems, item];
    }
    newItems = newItems.map((item, i) => ({ ...item, orderIndex: i }));
    setLocalItems(newItems);
    setHasChanges(true);
    setItemDialogOpen(false);
  };

  const getActionTypeInfo = (actionType: IvrActionType): ActionTypeInfo | undefined => {
    return actionTypesData?.actionTypes?.find(at => at.type === actionType);
  };

  const usedDigits = localItems.map(item => item.digit);
  const availableDigits = DIGIT_OPTIONS.filter(d => !usedDigits.includes(d) || (editingItemIndex !== null && localItems[editingItemIndex]?.digit === d));

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-spinner">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
              <Phone className="h-6 w-6" />
              Phone Menu Settings
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure what callers hear when they call your business
            </p>
          </div>
          {hasChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              Unsaved Changes
            </Badge>
          )}
        </div>

        <Form {...form}>
          <form className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Greeting & Voice
                </CardTitle>
                <CardDescription>
                  The message callers hear when they first call
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="greetingText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Welcome Message</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Thanks for calling [Business Name]. Press 1 for..."
                          className="min-h-[100px]"
                          data-testid="input-greeting"
                          onChange={(e) => {
                            field.onChange(e);
                            setHasChanges(true);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        This is the first thing callers hear. Include all menu options.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="voiceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voice</FormLabel>
                        <Select 
                          value={field.value} 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setHasChanges(true);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-voice">
                              <SelectValue placeholder="Select voice" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {VOICE_OPTIONS.map(voice => (
                              <SelectItem key={voice.value} value={voice.value}>
                                {voice.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxAttempts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Retries</FormLabel>
                        <Select 
                          value={String(field.value)} 
                          onValueChange={(value) => {
                            field.onChange(parseInt(value));
                            setHasChanges(true);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-retries">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map(n => (
                              <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'attempt' : 'attempts'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="noInputMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No Input Message</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="We didn't receive any input. Let me repeat the menu."
                            data-testid="input-no-input"
                            onChange={(e) => {
                              field.onChange(e);
                              setHasChanges(true);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invalidInputMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invalid Input Message</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Sorry, that's not a valid option."
                            data-testid="input-invalid"
                            onChange={(e) => {
                              field.onChange(e);
                              setHasChanges(true);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Menu Options
                    </CardTitle>
                    <CardDescription>
                      What happens when callers press each digit
                    </CardDescription>
                  </div>
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={handleAddItem}
                    disabled={availableDigits.length === 0}
                    data-testid="button-add-item"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {localItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-items">
                    <Hash className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No menu options configured</p>
                    <p className="text-sm">Add options for callers to choose from</p>
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="menu-items-list">
                    {localItems
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((item, index) => {
                        const ActionIcon = ACTION_TYPE_ICONS[item.actionType] || Phone;
                        const typeInfo = getActionTypeInfo(item.actionType);
                        
                        return (
                          <div
                            key={`${item.digit}-${index}`}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                            data-testid={`menu-item-${item.digit}`}
                          >
                            <div className="flex items-center gap-2 shrink-0">
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                              <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-lg font-mono">
                                {item.digit}
                              </Badge>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{item.label}</span>
                                {item.isHidden && (
                                  <Badge variant="secondary" className="text-xs">
                                    <EyeOff className="h-3 w-3 mr-1" />
                                    Hidden
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <ActionIcon className="h-3 w-3" />
                                <span>{typeInfo?.label || item.actionType}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditItem(index)}
                                data-testid={`button-edit-${item.digit}`}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteItem(index)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-${item.digit}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </Form>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t">
          <div className="container max-w-2xl mx-auto flex gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  disabled={resetMutation.isPending}
                  data-testid="button-reset"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset to Default?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset your phone menu to the default configuration. All your current settings will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => resetMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              type="button"
              className="flex-1"
              onClick={handleSave}
              disabled={updateMutation.isPending || !hasChanges}
              data-testid="button-save"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <MenuItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          item={editingItemIndex !== null ? localItems[editingItemIndex] : null}
          availableDigits={availableDigits}
          actionTypes={actionTypesData?.actionTypes || []}
          onSave={handleSaveItem}
        />
      </div>
    </AppShell>
  );
}

interface MenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: IvrMenuItem | null;
  availableDigits: string[];
  actionTypes: ActionTypeInfo[];
  onSave: (item: IvrMenuItem) => void;
}

function MenuItemDialog({ open, onOpenChange, item, availableDigits, actionTypes, onSave }: MenuItemDialogProps) {
  const [digit, setDigit] = useState(item?.digit || '');
  const [label, setLabel] = useState(item?.label || '');
  const [actionType, setActionType] = useState<IvrActionType>(item?.actionType || 'PLAY_MESSAGE');
  const [payload, setPayload] = useState<Record<string, any>>(item?.actionPayload || {});
  const [isHidden, setIsHidden] = useState(item?.isHidden || false);

  if (open && item && digit !== item.digit) {
    setDigit(item.digit);
    setLabel(item.label);
    setActionType(item.actionType);
    setPayload(item.actionPayload || {});
    setIsHidden(item.isHidden);
  }

  if (open && !item && digit !== '') {
    setDigit('');
    setLabel('');
    setActionType('PLAY_MESSAGE');
    setPayload({});
    setIsHidden(false);
  }

  const selectedActionType = actionTypes.find(at => at.type === actionType);

  const handleSave = () => {
    if (!digit || !label) return;
    
    onSave({
      digit,
      label,
      actionType,
      actionPayload: payload,
      orderIndex: item?.orderIndex || 0,
      isHidden,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Menu Option' : 'Add Menu Option'}</DialogTitle>
          <DialogDescription>
            Configure what happens when a caller presses this digit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1">
              <Label htmlFor="digit">Digit</Label>
              <Select value={digit} onValueChange={setDigit}>
                <SelectTrigger data-testid="select-digit">
                  <SelectValue placeholder="#" />
                </SelectTrigger>
                <SelectContent>
                  {(item ? [item.digit, ...availableDigits.filter(d => d !== item.digit)] : availableDigits).map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Talk to someone"
                data-testid="input-label"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="action">Action Type</Label>
            <Select value={actionType} onValueChange={(v) => {
              setActionType(v as IvrActionType);
              setPayload({});
            }}>
              <SelectTrigger data-testid="select-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actionTypes.map(at => (
                  <SelectItem key={at.type} value={at.type}>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = ACTION_TYPE_ICONS[at.type as IvrActionType] || Phone;
                        return <Icon className="h-4 w-4" />;
                      })()}
                      {at.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedActionType && (
              <p className="text-xs text-muted-foreground mt-1">{selectedActionType.description}</p>
            )}
          </div>

          {selectedActionType?.payloadFields && selectedActionType.payloadFields.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-medium">Action Settings</Label>
              {selectedActionType.payloadFields.map(field => (
                <div key={field.name}>
                  <Label htmlFor={field.name} className="text-sm">
                    {field.name.charAt(0).toUpperCase() + field.name.slice(1).replace(/([A-Z])/g, ' $1')}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.type === 'boolean' ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Switch
                        checked={payload[field.name] ?? true}
                        onCheckedChange={(checked) => setPayload({ ...payload, [field.name]: checked })}
                      />
                      <span className="text-sm text-muted-foreground">{field.description}</span>
                    </div>
                  ) : field.type === 'text' ? (
                    <Textarea
                      id={field.name}
                      value={payload[field.name] || ''}
                      onChange={(e) => setPayload({ ...payload, [field.name]: e.target.value })}
                      placeholder={field.description}
                      className="mt-1"
                      data-testid={`input-payload-${field.name}`}
                    />
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type === 'tel' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
                      value={payload[field.name] || ''}
                      onChange={(e) => setPayload({ ...payload, [field.name]: field.type === 'number' ? parseInt(e.target.value) : e.target.value })}
                      placeholder={field.description}
                      className="mt-1"
                      data-testid={`input-payload-${field.name}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Switch
              checked={isHidden}
              onCheckedChange={setIsHidden}
              data-testid="switch-hidden"
            />
            <div>
              <Label className="text-sm">Hide from menu</Label>
              <p className="text-xs text-muted-foreground">Option works but isn't announced in the greeting (easter egg)</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!digit || !label}
            data-testid="button-save-item"
          >
            {item ? 'Update' : 'Add'} Option
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
