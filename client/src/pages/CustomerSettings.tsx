import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ArrowLeft, Camera, Save, Mail, Phone, MapPin, Car, Bell, FileText, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomerData {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vehicleInfo: string | null;
  profilePictureUrl: string | null;
  customerNotes: string | null;
  notifyViaEmail: boolean;
  notifyViaSms: boolean;
  notifyViaPush: boolean;
}

export default function CustomerSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<CustomerData>>({});
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data, isLoading } = useQuery<{ customer: CustomerData }>({
    queryKey: ['/api/portal/me'],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<CustomerData>) => {
      const res = await apiRequest('PUT', '/api/portal/profile', updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal/me'] });
      toast({
        title: 'Success',
        description: 'Your profile has been updated',
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Profile picture must be under 2MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const res = await fetch('/api/portal/upload-profile-picture', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const result = await res.json();

      toast({
        title: 'Success',
        description: 'Profile picture updated',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/portal/me'] });
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload profile picture',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({});
    setIsEditing(false);
  };

  const handleEdit = () => {
    if (data?.customer) {
      setFormData(data.customer);
    }
    setIsEditing(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>Failed to load your profile</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/portal')} className="w-full">
              Back to Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const customer = data.customer;
  const displayData = isEditing ? formData : customer;
  const initials = customer.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/portal')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
              <p className="text-muted-foreground">Manage your account and preferences</p>
            </div>
          </div>
          {!isEditing && (
            <Button onClick={handleEdit} data-testid="button-edit-profile">
              <User className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>

        {/* Profile Picture Card */}
        <Card data-testid="card-profile-picture">
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>Upload a photo to personalize your account</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={customer.profilePictureUrl || undefined} alt={customer.name} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label htmlFor="profile-picture" className="cursor-pointer">
                <div
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 w-fit"
                  data-testid="button-upload-picture"
                >
                  <Camera className="h-4 w-4" />
                  {uploadingImage ? 'Uploading...' : 'Change Picture'}
                </div>
                <Input
                  id="profile-picture"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  data-testid="input-profile-picture"
                />
              </Label>
              <p className="text-sm text-muted-foreground mt-2">
                JPG, PNG, or GIF. Max 2MB.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information Card */}
        <Card data-testid="card-personal-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Your contact details and vehicle information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={displayData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={displayData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-phone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={displayData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
              </Label>
              <Input
                id="address"
                value={displayData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!isEditing}
                placeholder="123 Main St, City, State 12345"
                data-testid="input-address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicleInfo" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicle Information
              </Label>
              <Input
                id="vehicleInfo"
                value={displayData.vehicleInfo || ''}
                onChange={(e) => setFormData({ ...formData, vehicleInfo: e.target.value })}
                disabled={!isEditing}
                placeholder="2020 Toyota Camry"
                data-testid="input-vehicle"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences Card */}
        <Card data-testid="card-notifications">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Choose how you want to receive updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-email">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive appointment reminders and updates via email
                </p>
              </div>
              <Switch
                id="notify-email"
                checked={displayData.notifyViaEmail ?? true}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, notifyViaEmail: checked })
                }
                disabled={!isEditing}
                data-testid="switch-notify-email"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-sms">SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive text message updates about your appointments
                </p>
              </div>
              <Switch
                id="notify-sms"
                checked={displayData.notifyViaSms ?? true}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, notifyViaSms: checked })
                }
                disabled={!isEditing}
                data-testid="switch-notify-sms"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-push">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get instant updates when the app is installed
                </p>
              </div>
              <Switch
                id="notify-push"
                checked={displayData.notifyViaPush ?? false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, notifyViaPush: checked })
                }
                disabled={!isEditing}
                data-testid="switch-notify-push"
              />
            </div>
          </CardContent>
        </Card>

        {/* Personal Notes Card */}
        <Card data-testid="card-notes">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Personal Notes & Preferences
            </CardTitle>
            <CardDescription>
              Add any special requests or preferences for your service
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={displayData.customerNotes || ''}
              onChange={(e) => setFormData({ ...formData, customerNotes: e.target.value })}
              disabled={!isEditing}
              placeholder="E.g., Please call when you arrive, sensitive to certain chemicals, etc."
              className="min-h-[120px]"
              maxLength={2000}
              data-testid="textarea-notes"
            />
            <p className="text-sm text-muted-foreground mt-2">
              {(displayData.customerNotes?.length || 0)}/2000 characters
            </p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={updateProfileMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save"
            >
              {updateProfileMutation.isPending ? (
                'Saving...'
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
