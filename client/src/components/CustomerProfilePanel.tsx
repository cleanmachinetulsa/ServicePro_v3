import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Car,
  FileText,
  Tag as TagIcon,
  Plus,
  X,
  Calendar,
  CheckCircle,
  Clock,
  Flame,
  Crown,
  Shield,
  Bell,
  DollarSign,
  Repeat,
  AlertCircle,
  PhoneOff,
  PhoneCall,
} from 'lucide-react';
import { format } from 'date-fns';

interface CustomerTag {
  id: number;
  name: string;
  color: string;
  icon: string | null;
}

interface AppointmentHistory {
  id: number;
  scheduledTime: string;
  completed: boolean;
  serviceName: string;
  address: string;
}

interface CustomerProfile {
  conversation: any;
  customer: any;
  appointmentHistory: AppointmentHistory[];
  tags: CustomerTag[];
}

interface Props {
  conversationId: number;
}

const tagColorMap: Record<string, string> = {
  red: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
  green: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200',
  gray: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200',
};

const iconMap: Record<string, any> = {
  Flame,
  Crown,
  Shield,
  Bell,
  DollarSign,
  Repeat,
  AlertCircle,
  Calendar,
  TagIcon,
};

export default function CustomerProfilePanel({ conversationId }: Props) {
  const [showAddTag, setShowAddTag] = useState(false);
  const queryClient = useQueryClient();

  // Fetch customer profile
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['/api/tags/customer-profile', conversationId],
    enabled: !!conversationId,
  });

  // Fetch all available tags
  const { data: allTagsData } = useQuery({
    queryKey: ['/api/tags'],
  });

  const profile: CustomerProfile | undefined = (profileData as any)?.data;
  const allTags: CustomerTag[] = (allTagsData as any)?.data || [];
  const availableTags = allTags.filter(
    (tag) => !profile?.tags.find((t) => t.id === tag.id)
  );

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      return await apiRequest('POST', `/api/tags/conversation/${conversationId}/add/${tagId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags/customer-profile', conversationId] });
      setShowAddTag(false);
    },
  });

  // Remove tag mutation
  const removeTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      return await apiRequest('DELETE', `/api/tags/conversation/${conversationId}/remove/${tagId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags/customer-profile', conversationId] });
    },
  });

  // Click-to-Call mutation
  const clickToCallMutation = useMutation({
    mutationFn: async (customerPhone: string) => {
      return await apiRequest('POST', '/api/voice/click-to-call', { customerPhone });
    },
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-sm text-muted-foreground text-center">
          No conversation selected
        </div>
      </div>
    );
  }

  const { conversation, customer, appointmentHistory, tags } = profile;

  const IconComponent = (iconName: string) => {
    const Icon = iconMap[iconName] || TagIcon;
    return <Icon className="h-3 w-3" />;
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium">
                  {conversation.customerName || 'Unknown'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm">{conversation.customerPhone}</div>
              </div>
            </div>

            {customer?.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm">{customer.email}</div>
                </div>
              </div>
            )}

            {customer?.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm">{customer.address}</div>
                </div>
              </div>
            )}

            {customer?.vehicleInfo && (
              <div className="flex items-start gap-3">
                <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm">{customer.vehicleInfo}</div>
                </div>
              </div>
            )}

            {customer?.notes && (
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">{customer.notes}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => clickToCallMutation.mutate(conversation.customerPhone)}
              disabled={clickToCallMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-click-to-call"
            >
              <PhoneCall className="h-4 w-4 mr-2" />
              {clickToCallMutation.isPending ? 'Calling...' : 'Call Customer'}
            </Button>
            {clickToCallMutation.isSuccess && (
              <div className="mt-2 text-xs text-green-600 dark:text-green-400 text-center">
                ✓ Call initiated! Your phone should ring shortly.
              </div>
            )}
            {clickToCallMutation.isError && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400 text-center">
                Failed to initiate call. Please try again.
              </div>
            )}
          </CardContent>
        </Card>

        {/* SMS Opt-Out Status */}
        {conversation?.platform === 'sms' && (
          <Card>
            <CardContent className="pt-6">
              {conversation.smsOptOut ? (
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <PhoneOff className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-red-900 dark:text-red-200 text-sm">
                      SMS Opted Out
                    </div>
                    <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Customer replied STOP on {conversation.smsOptOutAt ? format(new Date(conversation.smsOptOutAt), 'MMM d, yyyy') : 'recently'}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Cannot send SMS until they reply START
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <PhoneCall className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-green-900 dark:text-green-200 text-sm">
                      SMS Enabled
                    </div>
                    <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Customer can receive SMS messages
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tags Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TagIcon className="h-5 w-5" />
                Tags
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddTag(!showAddTag)}
                data-testid="button-add-tag"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAddTag && availableTags.length > 0 && (
              <div className="mb-3">
                <Select
                  onValueChange={(value) => addTagMutation.mutate(parseInt(value))}
                  disabled={addTagMutation.isPending}
                >
                  <SelectTrigger data-testid="select-tag">
                    <SelectValue placeholder="Select a tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id.toString()}>
                        <div className="flex items-center gap-2">
                          {tag.icon && IconComponent(tag.icon)}
                          <span>{tag.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {tags.length === 0 && !showAddTag && (
                <div className="text-sm text-muted-foreground">No tags added</div>
              )}
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className={`${tagColorMap[tag.color] || tagColorMap.gray} flex items-center gap-1`}
                  data-testid={`tag-${tag.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {tag.icon && IconComponent(tag.icon)}
                  <span>{tag.name}</span>
                  <button
                    onClick={() => removeTagMutation.mutate(tag.id)}
                    className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                    disabled={removeTagMutation.isPending}
                    data-testid={`button-remove-tag-${tag.id}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service History Card */}
        {appointmentHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Service History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {appointmentHistory.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    data-testid={`appointment-${appt.id}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {appt.completed ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{appt.serviceName}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(appt.scheduledTime), 'MMM d, yyyy h:mm a')}
                      </div>
                      {appt.address && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {appt.address}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              data-testid="button-call-customer"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call Customer
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              data-testid="button-view-history"
            >
              <Calendar className="h-4 w-4 mr-2" />
              View Full History
            </Button>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
