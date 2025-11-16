import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, MapPin, Clock, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Job {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string;
  description: string;
  requirements: string | null;
  benefits: string | null;
  salaryRange: string | null;
}

export default function Careers() {
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['/api/jobs'],
  });

  const jobs: Job[] = data?.jobs || [];

  const applyMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch('/api/jobs/apply', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to submit application');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Application submitted!', description: 'We will review your application and get back to you soon.' });
      setShowApplicationDialog(false);
      setSelectedJob(null);
      setResumeFile(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (selectedJob) {
      formData.append('jobPostingId', selectedJob.id.toString());
    }
    if (resumeFile) {
      formData.append('resume', resumeFile);
    }
    applyMutation.mutate(formData);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Join Our Team</h1>
        <p className="text-xl text-muted-foreground">
          Help us deliver exceptional auto detailing services
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading opportunities...</div>
      ) : jobs.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No open positions at this time. Check back soon!</p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {jobs.map((job) => (
            <Card key={job.id} data-testid={`card-job-${job.id}`}>
              <CardHeader>
                <CardTitle className="text-2xl">{job.title}</CardTitle>
                <CardDescription className="flex flex-wrap gap-4 mt-2">
                  {job.department && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      {job.department}
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {job.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {job.employmentType}
                  </span>
                  {job.salaryRange && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {job.salaryRange}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
                </div>
                {job.requirements && (
                  <div>
                    <h3 className="font-semibold mb-2">Requirements</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
                  </div>
                )}
                {job.benefits && (
                  <div>
                    <h3 className="font-semibold mb-2">Benefits</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.benefits}</p>
                  </div>
                )}
                <Button
                  onClick={() => {
                    setSelectedJob(job);
                    setShowApplicationDialog(true);
                  }}
                  className="w-full sm:w-auto"
                  data-testid={`button-apply-${job.id}`}
                >
                  Apply Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showApplicationDialog} onOpenChange={setShowApplicationDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply for {selectedJob?.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleApply} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input name="firstName" required data-testid="input-first-name" />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input name="lastName" required data-testid="input-last-name" />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" name="email" required data-testid="input-email" />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input type="tel" name="phone" required data-testid="input-phone" />
            </div>
            <div>
              <Label>Resume/CV *</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                required
                data-testid="input-resume"
              />
            </div>
            <div>
              <Label>Years of Experience</Label>
              <Input type="number" name="yearsExperience" data-testid="input-experience" />
            </div>
            <div>
              <Label>Current Company</Label>
              <Input name="currentCompany" data-testid="input-company" />
            </div>
            <div>
              <Label>LinkedIn Profile</Label>
              <Input type="url" name="linkedinUrl" placeholder="https://linkedin.com/in/..." data-testid="input-linkedin" />
            </div>
            <div>
              <Label>Portfolio URL</Label>
              <Input type="url" name="portfolioUrl" data-testid="input-portfolio" />
            </div>
            <div>
              <Label>Cover Letter</Label>
              <Textarea
                name="coverLetter"
                rows={6}
                placeholder="Tell us why you'd be a great fit..."
                data-testid="textarea-cover-letter"
              />
            </div>
            <Button type="submit" className="w-full" disabled={applyMutation.isPending} data-testid="button-submit-application">
              {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
