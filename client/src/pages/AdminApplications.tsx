import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, Mail, Phone, Calendar, ExternalLink, FileText } from 'lucide-react';

interface Application {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeUrl: string | null;
  coverLetter: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  yearsExperience: number | null;
  currentCompany: string | null;
  status: string;
  notes: string | null;
  submittedAt: string;
  jobPosting?: {
    title: string;
  };
}

export default function AdminApplications() {
  const { toast } = useToast();
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/applications'],
  });

  const applications: Application[] = data?.applications || [];

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes: string }) => {
      return await apiRequest(`/api/admin/applications/${id}`, 'PUT', { status, notes });
    },
    onSuccess: () => {
      toast({ title: 'Updated!', description: 'Application status saved' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/applications'] });
      setShowDialog(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleViewApplication = (app: Application) => {
    setSelectedApp(app);
    setStatus(app.status);
    setNotes(app.notes || '');
    setShowDialog(true);
  };

  const handleSave = () => {
    if (selectedApp) {
      updateMutation.mutate({ id: selectedApp.id, status, notes });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'reviewing': return 'bg-yellow-100 text-yellow-800';
      case 'interviewing': return 'bg-purple-100 text-purple-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'hired': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filterByStatus = (apps: Application[], status: string) => {
    if (status === 'all') return apps;
    return apps.filter(app => app.status === status);
  };

  const statusCounts = {
    all: applications.length,
    new: applications.filter(a => a.status === 'new').length,
    reviewing: applications.filter(a => a.status === 'reviewing').length,
    interviewing: applications.filter(a => a.status === 'interviewing').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    hired: applications.filter(a => a.status === 'hired').length,
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Job Applications</h1>
        <p className="text-muted-foreground">Review and manage candidate applications</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full">
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="new">New ({statusCounts.new})</TabsTrigger>
          <TabsTrigger value="reviewing">Reviewing ({statusCounts.reviewing})</TabsTrigger>
          <TabsTrigger value="interviewing">Interviewing ({statusCounts.interviewing})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({statusCounts.rejected})</TabsTrigger>
          <TabsTrigger value="hired">Hired ({statusCounts.hired})</TabsTrigger>
        </TabsList>

        {(['all', 'new', 'reviewing', 'interviewing', 'rejected', 'hired'] as const).map(statusFilter => (
          <TabsContent key={statusFilter} value={statusFilter} className="mt-6">
            {isLoading ? (
              <div className="text-center py-8">Loading applications...</div>
            ) : filterByStatus(applications, statusFilter).length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No applications in this category</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filterByStatus(applications, statusFilter).map((app) => (
                  <Card 
                    key={app.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleViewApplication(app)}
                    data-testid={`card-application-${app.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {app.firstName} {app.lastName}
                        </CardTitle>
                        <Badge className={getStatusColor(app.status)}>{app.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="w-4 h-4" />
                        {app.jobPosting?.title || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        {app.email}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedApp?.firstName} {selectedApp?.lastName}
            </DialogTitle>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Position</Label>
                  <p className="font-semibold">{selectedApp.jobPosting?.title || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Applied</Label>
                  <p className="font-semibold">{new Date(selectedApp.submittedAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{selectedApp.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p>{selectedApp.phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Experience</Label>
                  <p>{selectedApp.yearsExperience || 'N/A'} years</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Current Company</Label>
                  <p>{selectedApp.currentCompany || 'N/A'}</p>
                </div>
              </div>

              {selectedApp.resumeUrl && (
                <div>
                  <Label className="text-muted-foreground">Resume</Label>
                  <Button variant="outline" asChild className="w-full mt-1">
                    <a href={selectedApp.resumeUrl} target="_blank" rel="noopener noreferrer" data-testid="link-resume">
                      <FileText className="w-4 h-4 mr-2" />
                      View Resume
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </div>
              )}

              {selectedApp.linkedinUrl && (
                <div>
                  <Label className="text-muted-foreground">LinkedIn</Label>
                  <Button variant="outline" asChild className="w-full mt-1">
                    <a href={selectedApp.linkedinUrl} target="_blank" rel="noopener noreferrer" data-testid="link-linkedin">
                      LinkedIn Profile
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </div>
              )}

              {selectedApp.portfolioUrl && (
                <div>
                  <Label className="text-muted-foreground">Portfolio</Label>
                  <Button variant="outline" asChild className="w-full mt-1">
                    <a href={selectedApp.portfolioUrl} target="_blank" rel="noopener noreferrer" data-testid="link-portfolio">
                      View Portfolio
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </div>
              )}

              {selectedApp.coverLetter && (
                <div>
                  <Label className="text-muted-foreground">Cover Letter</Label>
                  <div className="mt-1 p-3 bg-muted rounded whitespace-pre-wrap text-sm">
                    {selectedApp.coverLetter}
                  </div>
                </div>
              )}

              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="interviewing">Interviewing</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="hired">Hired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Admin Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this candidate..."
                  data-testid="textarea-notes"
                />
              </div>

              <Button
                onClick={handleSave}
                className="w-full"
                disabled={updateMutation.isPending}
                data-testid="button-save"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
