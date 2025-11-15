import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Mail, 
  Edit,
  Trash2,
  Plus,
  Loader2,
  Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  content: string;
  category: string;
  lastUsed: string | null;
}

export default function EmailTemplatesManager() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: '',
    category: 'general',
  });

  // Fetch all email templates
  const { data: templatesData, isLoading } = useQuery<{ success: boolean; templates: EmailTemplate[] }>({
    queryKey: ['/api/email-templates'],
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('POST', '/api/email-templates', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      setShowDialog(false);
      resetForm();
      toast({
        title: 'Template created',
        description: 'Email template has been successfully created',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Create failed',
        description: error.message || 'Failed to create email template',
        variant: 'destructive',
      });
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<EmailTemplate> }) => {
      return await apiRequest('PUT', `/api/email-templates/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      setShowDialog(false);
      resetForm();
      toast({
        title: 'Template updated',
        description: 'Email template has been successfully updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update email template',
        variant: 'destructive',
      });
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/email-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      toast({
        title: 'Template deleted',
        description: 'Email template has been successfully deleted',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete email template',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      subject: '',
      content: '',
      category: 'general',
    });
    setSelectedTemplate(null);
    setIsEditing(false);
  };

  const handleCreate = () => {
    resetForm();
    setIsEditing(false);
    setShowDialog(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      content: template.content,
      category: template.category,
    });
    setIsEditing(true);
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.subject.trim() || !formData.content.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (isEditing && selectedTemplate) {
      updateMutation.mutate({
        id: selectedTemplate.id,
        updates: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (template: EmailTemplate) => {
    if (confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      deleteMutation.mutate(template.id);
    }
  };

  const templates = templatesData?.templates || [];
  const categories = Array.from(new Set(templates.map(t => t.category)));
  const filteredTemplates = categoryFilter === 'all' 
    ? templates 
    : templates.filter(t => t.category === categoryFilter);

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, EmailTemplate[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Email Templates Manager
          </h2>
          <p className="text-muted-foreground mt-1">
            Create and manage reusable email templates for campaigns
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-category-filter">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={handleCreate} data-testid="button-create-template">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Templates can be used when creating email campaigns. They're reusable patterns that save time and ensure consistency.
        </AlertDescription>
      </Alert>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No email templates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first email template to get started
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-4">
          {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
            <AccordionItem key={category} value={category} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{categoryTemplates.length}</Badge>
                  <span className="font-semibold">
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 mt-3">
                  {categoryTemplates.map(template => (
                    <Card key={template.id} data-testid={`template-card-${template.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              {template.name}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              <strong>Subject:</strong> {template.subject}
                            </CardDescription>
                            {template.lastUsed && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Last used: {new Date(template.lastUsed).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap">
                            {template.content}
                          </p>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(template)}
                            data-testid={`button-edit-${template.id}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(template)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${template.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit' : 'Create'} Email Template</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the template details' : 'Create a new reusable email template'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Summer Promotion"
                data-testid="input-template-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="template-category" data-testid="select-template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="promotional">Promotional</SelectItem>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-subject">
                Email Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="template-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., Special Summer Offer - 20% Off!"
                data-testid="input-template-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-content">
                Email Content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="template-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={12}
                placeholder="Write your email content here..."
                className="font-mono text-sm"
                data-testid="textarea-template-content"
              />
              <p className="text-xs text-muted-foreground">
                Character count: {formData.content.length}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                resetForm();
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {isEditing ? 'Update' : 'Create'} Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
