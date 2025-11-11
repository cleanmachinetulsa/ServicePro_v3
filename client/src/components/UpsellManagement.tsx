import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, Edit, Plus, RefreshCw } from 'lucide-react';

// Define form schema for upsell offers
const upsellFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  description: z.string().min(1, { message: "Description is required" }),
  serviceId: z.number().optional(),
  addOnService: z.boolean().default(false),
  discountPercentage: z.number().min(0).max(100).optional()
    .nullable()
    .transform(v => v === null ? undefined : v),
  discountAmount: z.number().min(0).optional()
    .nullable()
    .transform(v => v === null ? undefined : v),
  active: z.boolean().default(true),
  displayOrder: z.number().default(0),
  minimumPurchaseAmount: z.number().min(0).optional()
    .nullable()
    .transform(v => v === null ? undefined : v),
  applicableServiceIds: z.array(z.string()).default([]),
  validityDays: z.number().min(1).default(3),
}).refine((data) => {
  // Either discountPercentage or discountAmount must be provided
  return data.discountPercentage !== undefined || data.discountAmount !== undefined;
}, {
  message: "Either discount percentage or discount amount must be provided",
  path: ["discountPercentage"]
});

type UpsellFormValues = z.infer<typeof upsellFormSchema>;

// Interface for the upsell offer data structure
interface UpsellOffer {
  id: number;
  name: string;
  description: string;
  serviceId?: number;
  addOnService: boolean;
  discountPercentage?: number;
  discountAmount?: number;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  minimumPurchaseAmount?: number;
  applicableServiceIds?: string[];
  validityDays: number;
}

// Interface for the service data structure
interface Service {
  id: number;
  name: string;
  priceRange: string;
  description: string;
  duration: string;
  durationHours: number;
}

export function UpsellManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<UpsellOffer | null>(null);

  // Form setup for creating/editing upsell offers
  const form = useForm<UpsellFormValues>({
    resolver: zodResolver(upsellFormSchema),
    defaultValues: {
      name: "",
      description: "",
      serviceId: undefined,
      addOnService: false,
      discountPercentage: undefined,
      discountAmount: undefined,
      active: true,
      displayOrder: 0,
      minimumPurchaseAmount: undefined,
      applicableServiceIds: [],
      validityDays: 3,
    }
  });

  // Query to fetch all upsell offers
  const { data: upsellOffers, isLoading: isLoadingOffers, isError: isErrorOffers, refetch: refetchOffers } = useQuery({
    queryKey: ['/api/upsell/offers'],
    queryFn: async () => {
      const response = await fetch('/api/upsell/offers');
      if (!response.ok) {
        throw new Error('Failed to fetch upsell offers');
      }
      const data = await response.json();
      return data.offers as UpsellOffer[];
    }
  });

  // Query to fetch all services for the dropdown
  const { data: services, isLoading: isLoadingServices } = useQuery({
    queryKey: ['/api/services'],
    queryFn: async () => {
      const response = await fetch('/api/services');
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      const data = await response.json();
      return data.services as Service[];
    }
  });

  // Mutation for creating upsell offer
  const createUpsellMutation = useMutation({
    mutationFn: async (data: UpsellFormValues) => {
      return await apiRequest('/api/upsell/offers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Upsell offer created successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/upsell/offers'] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create upsell offer: ${error.message}`,
        variant: 'destructive',
        duration: 5000,
      });
    }
  });

  // Mutation for updating upsell offer
  const updateUpsellMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpsellFormValues }) => {
      return await apiRequest(`/api/upsell/offers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Upsell offer updated successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/upsell/offers'] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update upsell offer: ${error.message}`,
        variant: 'destructive',
        duration: 5000,
      });
    }
  });

  // Mutation for deleting upsell offer
  const deleteUpsellMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/upsell/offers/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Upsell offer deleted successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/upsell/offers'] });
      setIsDeleteDialogOpen(false);
      setSelectedOffer(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete upsell offer: ${error.message}`,
        variant: 'destructive',
        duration: 5000,
      });
    }
  });

  // Set form values when editing an offer
  useEffect(() => {
    if (selectedOffer && isDialogOpen) {
      form.reset({
        name: selectedOffer.name,
        description: selectedOffer.description,
        serviceId: selectedOffer.serviceId,
        addOnService: selectedOffer.addOnService,
        discountPercentage: selectedOffer.discountPercentage,
        discountAmount: selectedOffer.discountAmount,
        active: selectedOffer.active,
        displayOrder: selectedOffer.displayOrder,
        minimumPurchaseAmount: selectedOffer.minimumPurchaseAmount,
        applicableServiceIds: selectedOffer.applicableServiceIds || [],
        validityDays: selectedOffer.validityDays,
      });
    }
  }, [selectedOffer, isDialogOpen, form]);

  // Handle form submission
  const onSubmit = (values: UpsellFormValues) => {
    if (selectedOffer) {
      updateUpsellMutation.mutate({ id: selectedOffer.id, data: values });
    } else {
      createUpsellMutation.mutate(values);
    }
  };

  // Open dialog for creating a new offer
  const handleCreate = () => {
    setSelectedOffer(null);
    form.reset({
      name: "",
      description: "",
      serviceId: undefined,
      addOnService: false,
      discountPercentage: undefined,
      discountAmount: undefined,
      active: true,
      displayOrder: 0,
      minimumPurchaseAmount: undefined,
      applicableServiceIds: [],
      validityDays: 3,
    });
    setIsDialogOpen(true);
  };

  // Open dialog for editing an offer
  const handleEdit = (offer: UpsellOffer) => {
    setSelectedOffer(offer);
    setIsDialogOpen(true);
  };

  // Open confirmation dialog for deleting an offer
  const handleDelete = (offer: UpsellOffer) => {
    setSelectedOffer(offer);
    setIsDeleteDialogOpen(true);
  };

  // Confirm deletion
  const confirmDelete = () => {
    if (selectedOffer) {
      deleteUpsellMutation.mutate(selectedOffer.id);
    }
  };

  // Format currency display
  const formatCurrency = (amount?: number) => {
    if (amount === undefined) return '';
    return `$${amount.toFixed(2)}`;
  };

  // Format percentage display
  const formatPercentage = (percentage?: number) => {
    if (percentage === undefined) return '';
    return `${percentage}%`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Upsell Offers Management</h2>
        <div className="flex gap-2">
          <Button onClick={() => refetchOffers()} variant="outline" className="flex items-center gap-1">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={handleCreate} className="flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Create New Offer
          </Button>
        </div>
      </div>
      
      {isLoadingOffers ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading upsell offers...</p>
          </CardContent>
        </Card>
      ) : isErrorOffers ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-500">Error loading upsell offers</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {upsellOffers && upsellOffers.length > 0 ? (
            <Table>
              <TableCaption>List of upsell offers that can be applied after purchase</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upsellOffers.map((offer) => (
                  <TableRow key={offer.id}>
                    <TableCell className="font-medium">{offer.name}</TableCell>
                    <TableCell>
                      {services?.find(s => s.id === offer.serviceId)?.name || 'Add-on Service'}
                    </TableCell>
                    <TableCell>
                      {offer.discountPercentage 
                        ? formatPercentage(offer.discountPercentage) 
                        : formatCurrency(offer.discountAmount)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        offer.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {offer.active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>{offer.validityDays} days</TableCell>
                    <TableCell className="text-right flex justify-end gap-2">
                      <Button
                        onClick={() => handleEdit(offer)}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        onClick={() => handleDelete(offer)}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center">No upsell offers found. Create your first offer!</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Create/Edit Upsell Offer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[625px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedOffer ? "Edit Upsell Offer" : "Create New Upsell Offer"}</DialogTitle>
            <DialogDescription>
              {selectedOffer
                ? "Update the details of this upsell offer"
                : "Create a new upsell offer to present to customers after booking"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Offer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 20% Off Headlight Restoration" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for the upsell offer
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the value proposition of this offer..." 
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      A compelling description of what the customer will get
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="addOnService"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Add-on Service</FormLabel>
                          <FormDescription>
                            Is this an add-on rather than a full service?
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Active</FormLabel>
                          <FormDescription>
                            Make this offer available to customers
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingServices ? (
                          <SelectItem value="loading" disabled>Loading services...</SelectItem>
                        ) : (
                          services?.map((service) => (
                            <SelectItem key={service.id} value={service.id.toString()}>
                              {service.name} - {service.priceRange}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The service this upsell offers at a discount
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discountPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Percentage</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          placeholder="e.g., 15" 
                          {...field}
                          value={field.value === undefined ? '' : field.value}
                          onChange={(e) => {
                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                            field.onChange(value);
                            // Clear discount amount if percentage is entered
                            if (value !== undefined) {
                              form.setValue('discountAmount', undefined);
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Percentage discount (e.g., 15 for 15% off)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discountAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Amount</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          placeholder="e.g., 25" 
                          {...field}
                          value={field.value === undefined ? '' : field.value}
                          onChange={(e) => {
                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                            field.onChange(value);
                            // Clear discount percentage if amount is entered
                            if (value !== undefined) {
                              form.setValue('discountPercentage', undefined);
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Fixed amount discount (e.g., $25 off)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="validityDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validity (Days)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="e.g., 3" 
                          {...field}
                          value={field.value === undefined ? '3' : field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        How many days the offer is valid after booking
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          placeholder="e.g., 1" 
                          {...field}
                          value={field.value === undefined ? '0' : field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Order priority (higher numbers shown first)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="minimumPurchaseAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Purchase Amount</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        placeholder="e.g., 150" 
                        {...field}
                        value={field.value === undefined ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum purchase amount required to qualify for this offer (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="applicableServiceIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Applicable Services</FormLabel>
                    <FormDescription className="mb-2">
                      Select services this upsell can be offered with (none selected means all services)
                    </FormDescription>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {isLoadingServices ? (
                        <p>Loading services...</p>
                      ) : (
                        services?.map((service) => (
                          <div key={service.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`service-${service.id}`}
                              checked={field.value.includes(service.name)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, service.name]);
                                } else {
                                  field.onChange(field.value.filter(id => id !== service.name));
                                }
                              }}
                            />
                            <label 
                              htmlFor={`service-${service.id}`}
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {service.name}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createUpsellMutation.isPending || updateUpsellMutation.isPending}
                >
                  {createUpsellMutation.isPending || updateUpsellMutation.isPending ? (
                    <>Saving...</>
                  ) : selectedOffer ? (
                    <>Update Offer</>
                  ) : (
                    <>Create Offer</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the upsell offer "{selectedOffer?.name}"? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteUpsellMutation.isPending}
            >
              {deleteUpsellMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}