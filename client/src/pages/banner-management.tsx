import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Banner, InsertBanner } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBannerSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, Calendar, Target } from "lucide-react";
import { format } from "date-fns";

const formSchema = insertBannerSchema.extend({
  scheduleStart: z.string().optional(),
  scheduleEnd: z.string().optional(),
  pageTargets: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function BannerManagement() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  const { data: banners = [], isLoading } = useQuery<Banner[]>({
    queryKey: ["/api/banners"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertBanner) => {
      return await apiRequest("POST", "/api/banners", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      setIsCreateOpen(false);
      toast({ title: "Banner created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create banner", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertBanner> }) => {
      return await apiRequest("PATCH", `/api/banners/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      setEditingBanner(null);
      toast({ title: "Banner updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update banner", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/banners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      toast({ title: "Banner deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete banner", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const BannerForm = ({ banner, onClose }: { banner?: Banner; onClose: () => void }) => {
    const form = useForm<FormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        title: banner?.title || "",
        bodyText: banner?.bodyText || "",
        displayMode: banner?.displayMode || "top_bar",
        ctaLabel: banner?.ctaLabel || "",
        ctaUrl: banner?.ctaUrl || "",
        priority: banner?.priority ?? 0,
        pageTargets: banner?.pageTargets?.join(", ") || "",
        scheduleStart: banner?.scheduleStart ? format(new Date(banner.scheduleStart), "yyyy-MM-dd'T'HH:mm") : "",
        scheduleEnd: banner?.scheduleEnd ? format(new Date(banner.scheduleEnd), "yyyy-MM-dd'T'HH:mm") : "",
        isDismissible: banner?.isDismissible !== undefined ? banner.isDismissible : true,
        trackingKey: banner?.trackingKey || `banner_${Date.now()}`,
        themeColor: banner?.themeColor || "blue",
        isActive: banner?.isActive !== undefined ? banner.isActive : true,
      },
    });

    const onSubmit = (data: FormValues) => {
      const processedData: InsertBanner = {
        ...data,
        pageTargets: data.pageTargets
          ? data.pageTargets.split(",").map((p) => p.trim()).filter(Boolean)
          : [],
        scheduleStart: data.scheduleStart ? new Date(data.scheduleStart) : null,
        scheduleEnd: data.scheduleEnd ? new Date(data.scheduleEnd) : null,
      };

      if (banner) {
        updateMutation.mutate({ id: banner.id, data: processedData });
      } else {
        createMutation.mutate(processedData);
      }
    };

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Spring Special 2025" data-testid="input-banner-title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bodyText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Get 20% off all detailing services this month!" rows={3} data-testid="textarea-banner-message" />
                </FormControl>
                <FormDescription>Plain text or markdown supported</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="displayMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Mode</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-display-mode">
                        <SelectValue placeholder="Select display mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="top_bar">Top Bar</SelectItem>
                      <SelectItem value="modal">Modal</SelectItem>
                      <SelectItem value="floating">Floating</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="themeColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme Color</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-theme-color">
                        <SelectValue placeholder="Select color" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="yellow">Yellow</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ctaLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Button Text (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Book Now" data-testid="input-cta-label" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ctaUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Button URL (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="/" type="url" data-testid="input-cta-url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="pageTargets"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Pages (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="/, /services, /dashboard" data-testid="input-page-targets" />
                </FormControl>
                <FormDescription>Comma-separated paths. Leave empty for all pages.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="scheduleStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date/Time (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="datetime-local" data-testid="input-schedule-start" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduleEnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date/Time (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="datetime-local" data-testid="input-schedule-end" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? 0} type="number" placeholder="0" data-testid="input-priority" onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <FormDescription>Higher shows first</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isDismissible"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-between">
                  <FormLabel>Dismissible</FormLabel>
                  <FormControl>
                    <Switch checked={field.value ?? true} onCheckedChange={field.onChange} data-testid="switch-dismissible" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-between">
                  <FormLabel>Active</FormLabel>
                  <FormControl>
                    <Switch checked={field.value ?? true} onCheckedChange={field.onChange} data-testid="switch-active" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="trackingKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tracking Key</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="banner_spring_2025" data-testid="input-tracking-key" />
                </FormControl>
                <FormDescription>Unique identifier for tracking dismissals</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-banner">
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : banner ? "Update Banner" : "Create Banner"}
            </Button>
          </div>
        </form>
      </Form>
    );
  };

  if (isLoading) {
    return (
      <AppShell title="Banner Management">
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading banners...</div>
          </div>
        </div>
      </AppShell>
    );
  }

  const pageActions = (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-banner">
          <Plus className="h-4 w-4 mr-2" />
          Create Banner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Banner</DialogTitle>
        </DialogHeader>
        <BannerForm onClose={() => setIsCreateOpen(false)} />
      </DialogContent>
    </Dialog>
  );

  return (
    <AppShell title="Banner Management" pageActions={pageActions}>
      <div className="p-6">

      {banners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No banners yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first marketing banner to get started</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-banner">
              <Plus className="h-4 w-4 mr-2" />
              Create Banner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {banners.map((banner) => (
            <Card key={banner.id} data-testid={`card-banner-${banner.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle>{banner.title}</CardTitle>
                      {banner.isActive ? (
                        <Badge variant="default" data-testid={`badge-active-${banner.id}`}>Active</Badge>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-inactive-${banner.id}`}>Inactive</Badge>
                      )}
                      <Badge variant="outline">{banner.displayMode}</Badge>
                    </div>
                    <CardDescription>{banner.bodyText}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={editingBanner?.id === banner.id} onOpenChange={(open) => !open && setEditingBanner(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setEditingBanner(banner)} data-testid={`button-edit-${banner.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Banner</DialogTitle>
                        </DialogHeader>
                        <BannerForm banner={banner} onClose={() => setEditingBanner(null)} />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this banner?")) {
                          deleteMutation.mutate(banner.id);
                        }
                      }}
                      data-testid={`button-delete-${banner.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {banner.scheduleStart && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Start</div>
                        <div className="text-muted-foreground">{format(new Date(banner.scheduleStart), "MMM d, yyyy")}</div>
                      </div>
                    </div>
                  )}
                  {banner.scheduleEnd && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">End</div>
                        <div className="text-muted-foreground">{format(new Date(banner.scheduleEnd), "MMM d, yyyy")}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Pages</div>
                      <div className="text-muted-foreground">
                        {banner.pageTargets && banner.pageTargets.length > 0
                          ? banner.pageTargets.join(", ")
                          : "All pages"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Priority</div>
                      <div className="text-muted-foreground">{banner.priority}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </AppShell>
  );
}
