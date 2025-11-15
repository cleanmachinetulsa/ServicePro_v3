import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Facebook,
  Instagram,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Info,
  ExternalLink,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { FacebookPageToken } from '@shared/schema';
import { AppShell } from '@/components/AppShell';

interface FacebookPage extends FacebookPageToken {
  pageAccessToken: string;
}

interface PagesResponse {
  success: boolean;
  pages: FacebookPage[];
}

export default function FacebookSettings() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<FacebookPage | null>(null);

  // Form state
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [platform, setPlatform] = useState<'facebook' | 'instagram'>('facebook');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('clean_machine_verify_token_2025');

  // Fetch configured pages
  const { data: pagesData, isLoading } = useQuery<PagesResponse>({
    queryKey: ['/api/facebook/pages'],
  });

  const pages = pagesData?.pages || [];

  // Add page mutation
  const addPageMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/facebook/pages', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facebook/pages'] });
      toast({
        title: 'Success',
        description: 'Facebook page added successfully',
      });
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add Facebook page',
        variant: 'destructive',
      });
    },
  });

  // Update page mutation
  const updatePageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PUT', `/api/facebook/pages/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facebook/pages'] });
      toast({
        title: 'Success',
        description: 'Page settings updated',
      });
      setEditingPage(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update page',
        variant: 'destructive',
      });
    },
  });

  // Delete page mutation
  const deletePageMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/facebook/pages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facebook/pages'] });
      toast({
        title: 'Success',
        description: 'Facebook page removed',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete page',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setPageId('');
    setPageName('');
    setPageAccessToken('');
    setPlatform('facebook');
    setWebhookVerifyToken('clean_machine_verify_token_2025');
  };

  const handleAddPage = () => {
    if (!pageId || !pageName || !pageAccessToken) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    addPageMutation.mutate({
      pageId,
      pageName,
      pageAccessToken,
      platform,
      webhookVerifyToken,
      isActive: true,
    });
  };

  const handleToggleActive = (page: FacebookPage) => {
    updatePageMutation.mutate({
      id: page.id,
      data: { isActive: !page.isActive },
    });
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/facebook/webhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: 'Copied!',
      description: 'Webhook URL copied to clipboard',
    });
  };

  const webhookUrl = `${window.location.origin}/api/facebook/webhook`;

  const pageActions = (
    <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)} data-testid="add-facebook-page-button">
      <Plus className="h-4 w-4" />
      Add Page
    </Button>
  );

  return (
    <AppShell title="Facebook & Instagram Integration" pageActions={pageActions}>
      <div className="p-6">
        <p className="text-sm text-muted-foreground mb-6">
          Connect your Facebook Pages and Instagram accounts for messaging
        </p>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add Facebook/Instagram Page</DialogTitle>
                  <DialogDescription>
                    Connect a Facebook Page or Instagram Business account to receive messages
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform</Label>
                    <Select value={platform} onValueChange={(value: any) => setPlatform(value)}>
                      <SelectTrigger data-testid="platform-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="facebook">
                          <div className="flex items-center gap-2">
                            <Facebook className="h-4 w-4" />
                            Facebook
                          </div>
                        </SelectItem>
                        <SelectItem value="instagram">
                          <div className="flex items-center gap-2">
                            <Instagram className="h-4 w-4" />
                            Instagram
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pageId">Page ID *</Label>
                    <Input
                      id="pageId"
                      placeholder="1234567890"
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value)}
                      data-testid="input-page-id"
                    />
                    <p className="text-xs text-muted-foreground">
                      Found in Meta Business Suite → Page Settings
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pageName">Page Name *</Label>
                    <Input
                      id="pageName"
                      placeholder="Clean Machine Auto Detail"
                      value={pageName}
                      onChange={(e) => setPageName(e.target.value)}
                      data-testid="input-page-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pageAccessToken">Page Access Token *</Label>
                    <Input
                      id="pageAccessToken"
                      type="password"
                      placeholder="EAAxxxxxxxxxxxxxxx"
                      value={pageAccessToken}
                      onChange={(e) => setPageAccessToken(e.target.value)}
                      data-testid="input-access-token"
                    />
                    <p className="text-xs text-muted-foreground">
                      Generate in Meta Developer App → Messenger → Settings
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhookVerifyToken">Webhook Verify Token</Label>
                    <Input
                      id="webhookVerifyToken"
                      value={webhookVerifyToken}
                      onChange={(e) => setWebhookVerifyToken(e.target.value)}
                      data-testid="input-webhook-token"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use this token when setting up the webhook in Meta Developer Console
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddPage}
                    disabled={addPageMutation.isPending}
                    data-testid="button-submit-page"
                  >
                    {addPageMutation.isPending ? 'Adding...' : 'Add Page'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Webhook Configuration Card */}
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Webhook Configuration
              </CardTitle>
              <CardDescription>
                Use these settings when configuring your webhook in Meta Developer Console
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyWebhookUrl}
                    data-testid="copy-webhook-url"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Verify Token</Label>
                <Input
                  value="clean_machine_verify_token_2025"
                  readOnly
                  className="font-mono text-sm"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Setup Instructions
                </h4>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Go to Meta Developer Console → Your App → Messenger → Settings</li>
                  <li>Click "Add Callback URL"</li>
                  <li>Paste the Webhook URL above</li>
                  <li>Enter the Verify Token above</li>
                  <li>Subscribe to "messages" webhook events</li>
                  <li>Generate a Page Access Token and add it below</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Connected Pages */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Pages</CardTitle>
              <CardDescription>
                Manage your Facebook Pages and Instagram accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading pages...
                </div>
              ) : pages.length === 0 ? (
                <div className="text-center py-12">
                  <Facebook className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">No pages connected yet</p>
                  <Button onClick={() => setIsAddDialogOpen(true)} data-testid="add-first-page">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Page
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {pages.map((page) => (
                      <div
                        key={page.id}
                        className="border rounded-lg p-4 hover:border-primary transition-colors"
                        data-testid={`page-card-${page.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {page.platform === 'facebook' ? (
                              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                <Facebook className="h-5 w-5 text-blue-600" />
                              </div>
                            ) : (
                              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
                                <Instagram className="h-5 w-5 text-white" />
                              </div>
                            )}
                            
                            <div className="flex-1">
                              <h3 className="font-semibold">{page.pageName}</h3>
                              <p className="text-sm text-muted-foreground font-mono">
                                ID: {page.pageId}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={page.isActive ? 'default' : 'secondary'}>
                                  {page.isActive ? (
                                    <>
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Active
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Inactive
                                    </>
                                  )}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {page.platform}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Active</Label>
                              <Switch
                                checked={page.isActive}
                                onCheckedChange={() => handleToggleActive(page)}
                                disabled={updatePageMutation.isPending}
                                data-testid={`toggle-active-${page.id}`}
                              />
                            </div>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Remove ${page.pageName}?`)) {
                                  deletePageMutation.mutate(page.id);
                                }
                              }}
                              disabled={deletePageMutation.isPending}
                              data-testid={`delete-page-${page.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" />
                Need Help?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Where to find Page ID:</strong> Meta Business Suite → Settings → Page Info
              </p>
              <p>
                <strong>How to get Access Token:</strong> Meta Developer Console → Your App → Messenger → Settings → Generate Token
              </p>
              <p>
                <strong>Token Permissions:</strong> Ensure your token has <code className="bg-white dark:bg-gray-800 px-1 rounded">pages_messaging</code> and <code className="bg-white dark:bg-gray-800 px-1 rounded">pages_read_engagement</code> permissions
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
