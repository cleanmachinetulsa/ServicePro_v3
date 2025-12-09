import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { MessageSquare, Plus, Edit2, Trash2, Save, Settings2, Bell, Shield, Key, Send, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { QuickReplyCategory, QuickReplyTemplate } from '@shared/schema';
import { CommunicationsSettings } from '@/components/CommunicationsSettings';
import { AppShell } from '@/components/AppShell';
import { SmsTemplatesManager } from '@/components/SmsTemplatesManager';
import { NotificationPreferences } from '@/components/settings/NotificationPreferences';

interface CategoryWithTemplates extends QuickReplyCategory {
  templates: QuickReplyTemplate[];
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('templates');
  
  // Fetch categories with templates
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<{ success: boolean; data: CategoryWithTemplates[] }>({
    queryKey: ['/api/quick-replies/categories/with-templates'],
  });
  
  const categories = categoriesData?.data || [];
  
  return (
    <AppShell title="Communications Settings" showSearch={false}>
      <div className="p-6 max-w-6xl mx-auto">
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <MessageSquare className="h-4 w-4 mr-2" />
            Quick Reply Templates
          </TabsTrigger>
          <TabsTrigger value="sms-templates" data-testid="tab-sms-templates">
            <MessageCircle className="h-4 w-4 mr-2" />
            SMS Templates
          </TabsTrigger>
          <TabsTrigger value="communications" data-testid="tab-communications">
            <Send className="h-4 w-4 mr-2" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="templates" className="space-y-4">
          <TemplateManager categories={categories} isLoading={categoriesLoading} />
        </TabsContent>
        
        <TabsContent value="sms-templates" className="space-y-4">
          <SmsTemplatesManager />
        </TabsContent>
        
        <TabsContent value="communications" className="space-y-4">
          <CommunicationsSettings />
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-4">
          <NotificationsSettings />
        </TabsContent>
        
        <TabsContent value="security" className="space-y-4">
          <SecuritySettings />
        </TabsContent>
      </Tabs>
      </div>
    </AppShell>
  );
}

function TemplateManager({ categories, isLoading }: { categories: CategoryWithTemplates[]; isLoading: boolean }) {
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<QuickReplyCategory | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ template: QuickReplyTemplate; categoryId: number } | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newTemplateOpen, setNewTemplateOpen] = useState<number | null>(null);
  
  // Category form state
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '' });
  
  // Template form state
  const [templateForm, setTemplateForm] = useState({ content: '', categoryId: 0 });
  
  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; icon: string }) => {
      return await apiRequest('/api/quick-replies/categories', 'POST', data);
    },
    onSuccess: () => {
      toast({ title: 'Category created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/quick-replies/categories/with-templates'] });
      setNewCategoryOpen(false);
      setCategoryForm({ name: '', icon: '' });
    },
  });
  
  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; icon: string }) => {
      return await apiRequest(`/api/quick-replies/categories/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      toast({ title: 'Category updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/quick-replies/categories/with-templates'] });
      setEditingCategory(null);
    },
  });
  
  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/quick-replies/categories/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete category');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Category deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/quick-replies/categories/with-templates'] });
    },
  });
  
  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: { categoryId: number; content: string }) => {
      return await apiRequest('/api/quick-replies/templates', 'POST', data);
    },
    onSuccess: () => {
      toast({ title: 'Template created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/quick-replies/categories/with-templates'] });
      setNewTemplateOpen(null);
      setTemplateForm({ content: '', categoryId: 0 });
    },
  });
  
  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; content: string }) => {
      return await apiRequest(`/api/quick-replies/templates/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      toast({ title: 'Template updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/quick-replies/categories/with-templates'] });
      setEditingTemplate(null);
    },
  });
  
  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/quick-replies/templates/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete template');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Template deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/quick-replies/categories/with-templates'] });
    },
  });
  
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading templates...</div>;
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Create and organize quick reply templates for faster customer responses
        </p>
        <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-category">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
              <DialogDescription>Add a new category to organize your quick replies</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="categoryName">Category Name</Label>
                <Input
                  id="categoryName"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g., Greetings, Booking, Pricing"
                  data-testid="input-category-name"
                />
              </div>
              <div>
                <Label htmlFor="categoryIcon">Icon (emoji)</Label>
                <Input
                  id="categoryIcon"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  placeholder="e.g., 👋, 📅, 💰"
                  maxLength={2}
                  data-testid="input-category-icon"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createCategoryMutation.mutate(categoryForm)}
                disabled={!categoryForm.name || createCategoryMutation.isPending}
                data-testid="button-save-category"
              >
                <Save className="h-4 w-4 mr-2" />
                {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No quick reply categories yet</p>
            <p className="text-sm mt-2">Create your first category to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <Card key={category.id} data-testid={`category-${category.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {category.icon && <span className="text-xl">{category.icon}</span>}
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingCategory(category)}
                      data-testid={`button-edit-category-${category.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this category and all its templates?')) {
                          deleteCategoryMutation.mutate(category.id);
                        }
                      }}
                      data-testid={`button-delete-category-${category.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <CardDescription>{category.templates.length} templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {category.templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex justify-between items-start gap-2 p-2 rounded border bg-card hover:bg-accent/50 transition-colors"
                    data-testid={`template-${template.id}`}
                  >
                    <p className="text-sm flex-1">{template.content}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTemplate({ template, categoryId: category.id })}
                        data-testid={`button-edit-template-${template.id}`}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this template?')) {
                            deleteTemplateMutation.mutate(template.id);
                          }
                        }}
                        data-testid={`button-delete-template-${template.id}`}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewTemplateOpen(category.id);
                    setTemplateForm({ content: '', categoryId: category.id });
                  }}
                  className="w-full mt-2"
                  data-testid={`button-add-template-${category.id}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Edit Category Dialog */}
      {editingCategory && (
        <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category Name</Label>
                <Input
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  data-testid="input-edit-category-name"
                />
              </div>
              <div>
                <Label>Icon (emoji)</Label>
                <Input
                  value={editingCategory.icon || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                  maxLength={2}
                  data-testid="input-edit-category-icon"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => updateCategoryMutation.mutate({
                  id: editingCategory.id,
                  name: editingCategory.name,
                  icon: editingCategory.icon || ''
                })}
                disabled={updateCategoryMutation.isPending}
                data-testid="button-update-category"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateCategoryMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Add Template Dialog */}
      {newTemplateOpen !== null && (
        <Dialog open={newTemplateOpen !== null} onOpenChange={() => setNewTemplateOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Template Content</Label>
                <Textarea
                  value={templateForm.content}
                  onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                  placeholder="Enter your quick reply message..."
                  rows={4}
                  data-testid="input-template-content"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createTemplateMutation.mutate(templateForm)}
                disabled={!templateForm.content || createTemplateMutation.isPending}
                data-testid="button-save-template"
              >
                <Save className="h-4 w-4 mr-2" />
                {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Edit Template Dialog */}
      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Template Content</Label>
                <Textarea
                  value={editingTemplate.template.content}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    template: { ...editingTemplate.template, content: e.target.value }
                  })}
                  rows={4}
                  data-testid="input-edit-template-content"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => updateTemplateMutation.mutate({
                  id: editingTemplate.template.id,
                  content: editingTemplate.template.content
                })}
                disabled={updateTemplateMutation.isPending}
                data-testid="button-update-template"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateTemplateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function NotificationsSettings() {
  return (
    <div className="space-y-4">
      <NotificationPreferences />
    </div>
  );
}

function SecuritySettings() {
  const { toast } = useToast();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Fetch registered biometric devices
  const { data: credentialsData } = useQuery({
    queryKey: ['/api/webauthn/credentials'],
  });
  
  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest('/api/auth/change-password', 'POST', data);
    },
    onSuccess: () => {
      toast({ 
        title: 'Password changed successfully',
        description: 'Your password has been updated' 
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Password change failed',
        description: error.message || 'Invalid current password',
        variant: 'destructive'
      });
    },
  });
  
  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ 
        title: 'Passwords do not match',
        description: 'New password and confirmation must match',
        variant: 'destructive'
      });
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast({ 
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
        variant: 'destructive'
      });
      return;
    }
    
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password for enhanced security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
                className="mt-1"
                data-testid="input-current-password"
              />
            </div>
            
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
                minLength={6}
                className="mt-1"
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 6 characters
              </p>
            </div>
            
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
                className="mt-1"
                data-testid="input-confirm-password"
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              <Save className="h-4 w-4 mr-2" />
              {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Biometric Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Biometric Authentication
          </CardTitle>
          <CardDescription>
            Use fingerprint or face recognition to log in securely
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Biometric login requires HTTPS (secure connection). This feature will be available when you publish your app to production.
              </p>
            </div>
            
            {credentialsData?.credentials && credentialsData.credentials.length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-medium">Registered Devices</h4>
                {credentialsData.credentials.map((cred: any) => (
                  <div key={cred.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{cred.deviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(cred.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        await fetch(`/api/webauthn/credentials/${cred.id}`, { 
                          method: 'DELETE',
                          credentials: 'include'
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/webauthn/credentials'] });
                        toast({ title: 'Device removed' });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No biometric devices registered yet
              </p>
            )}
            
            <Button
              variant="outline"
              disabled={true}
              className="w-full"
              data-testid="button-add-biometric"
            >
              <Shield className="h-4 w-4 mr-2" />
              Add Biometric Device (Available in Production)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
