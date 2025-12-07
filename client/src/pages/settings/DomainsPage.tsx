/**
 * SP-DOMAINS-1: Tenant Domain Management Page
 * 
 * Allows tenant owners to view and manage custom domains.
 * Currently configuration-only - domains do not affect routing yet.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Globe, Plus, Star, Trash2, Loader2, Info } from 'lucide-react';

interface TenantDomain {
  id: number;
  tenantId: string;
  domain: string;
  isPrimary: boolean;
  status: 'pending' | 'verified' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export default function DomainsPage() {
  const { toast } = useToast();
  const [newDomain, setNewDomain] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<TenantDomain | null>(null);

  const { data, isLoading, error } = useQuery<{ success: boolean; domains: TenantDomain[] }>({
    queryKey: ['/api/settings/domains'],
  });

  const createMutation = useMutation({
    mutationFn: async (domain: string) => {
      return await apiRequest('POST', '/api/settings/domains', { domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/domains'] });
      toast({
        title: 'Domain added',
        description: 'Your custom domain has been registered.',
      });
      setNewDomain('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add domain',
        variant: 'destructive',
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (domainId: number) => {
      return await apiRequest('PUT', `/api/settings/domains/${domainId}`, { isPrimary: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/domains'] });
      toast({
        title: 'Primary domain updated',
        description: 'The primary domain has been changed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set primary domain',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (domainId: number) => {
      return await apiRequest('DELETE', `/api/settings/domains/${domainId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/domains'] });
      toast({
        title: 'Domain removed',
        description: 'The custom domain has been removed.',
      });
      setDeleteDialogOpen(false);
      setDomainToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove domain',
        variant: 'destructive',
      });
    },
  });

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    createMutation.mutate(newDomain.trim());
  };

  const handleDeleteClick = (domain: TenantDomain) => {
    setDomainToDelete(domain);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (domainToDelete) {
      deleteMutation.mutate(domainToDelete.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500/20 text-green-700 border-green-300">Verified</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Pending</Badge>;
    }
  };

  const domains = data?.domains || [];

  return (
    <AppShell>
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Custom Domains</h1>
            <p className="text-muted-foreground text-sm">
              Manage custom domains for your business website
            </p>
          </div>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Custom domains are a Pro+ feature. DNS and SSL setup assistance will be part of a future 
            guided wizard. For now you can register the domain you plan to connect.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Custom Domain</CardTitle>
            <CardDescription>
              Enter the domain you want to connect to your business website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddDomain} className="flex gap-3">
              <Input
                type="text"
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="flex-1"
                data-testid="input-new-domain"
              />
              <Button 
                type="submit" 
                disabled={createMutation.isPending || !newDomain.trim()}
                data-testid="button-add-domain"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add Domain
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Domains</CardTitle>
            <CardDescription>
              {domains.length === 0 
                ? 'No custom domains configured yet'
                : `${domains.length} domain${domains.length !== 1 ? 's' : ''} registered`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                Failed to load domains. Please try again.
              </div>
            ) : domains.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No domains registered yet.</p>
                <p className="text-sm">Add your first custom domain above.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow key={domain.id} data-testid={`row-domain-${domain.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {domain.domain}
                          {domain.isPrimary && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              Primary
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(domain.status)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {!domain.isPrimary && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPrimaryMutation.mutate(domain.id)}
                            disabled={setPrimaryMutation.isPending}
                            data-testid={`button-set-primary-${domain.id}`}
                          >
                            <Star className="w-3 h-3 mr-1" />
                            Set Primary
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(domain)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-${domain.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Domain</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{domainToDelete?.domain}</strong>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Remove Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
