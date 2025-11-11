import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Phone,
  User,
  XCircle,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

interface QuoteRequest {
  id: number;
  customerId: number | null;
  phone: string;
  customerName: string;
  issueDescription: string;
  damageType: string;
  photoUrls: string[];
  status: 'pending_review' | 'quoted' | 'approved' | 'declined' | 'completed';
  customQuoteAmount: number | null;
  quoteNotes: string | null;
  thirdPartyPayerName: string | null;
  thirdPartyPayerEmail: string | null;
  thirdPartyPayerPhone: string | null;
  poNumber: string | null;
  approverType: 'customer' | 'third_party' | null;
  approvalToken: string;
  approvedAt: string | null;
  declinedReason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  actualTimeSpent: number | null;
  difficultyRating: number | null;
  lessonLearned: string | null;
}

interface PricingSuggestion {
  minPrice: number | null;
  avgPrice: number | null;
  maxPrice: number | null;
  avgTimeSpent: number | null;
  avgDifficulty: number | null;
  similarJobs: Array<{
    id: number;
    issueDescription: string;
    customQuoteAmount: number;
    actualTimeSpent: number | null;
    difficultyRating: number | null;
  }>;
}

export default function AdminQuoteRequests() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all quote requests
  const { data: quotesData, isLoading: loadingQuotes } = useQuery<{
    success: boolean;
    quotes: QuoteRequest[];
  }>({
    queryKey: ['/api/quote-requests'],
  });

  // Fetch pending quote requests
  const { data: pendingData, isLoading: loadingPending } = useQuery<{
    success: boolean;
    quotes: QuoteRequest[];
  }>({
    queryKey: ['/api/quote-requests/pending'],
  });

  // Fetch pricing suggestions for selected quote
  const { data: suggestionsData, isLoading: loadingSuggestions } = useQuery<{
    success: boolean;
    suggestions: PricingSuggestion;
  }>({
    queryKey: ['/api/quote-requests', selectedQuote?.id, 'suggestions'],
    enabled: !!selectedQuote,
  });

  // Submit quote mutation
  const submitQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedQuote) throw new Error('No quote selected');
      
      const amount = parseFloat(quoteAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid quote amount');
      }

      return await apiRequest('POST', `/api/quote-requests/${selectedQuote.id}/quote`, {
        customQuoteAmount: amount,
        quoteNotes: quoteNotes.trim() || null,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Quote Sent',
        description: 'The custom quote has been sent to the customer for approval.',
      });
      // Invalidate both all quotes and pending quotes to update UI immediately
      queryClient.invalidateQueries({ queryKey: ['/api/quote-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quote-requests/pending'] });
      setSelectedQuote(null);
      setQuoteAmount('');
      setQuoteNotes('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit quote',
        variant: 'destructive',
      });
    },
  });

  const handleSelectQuote = (quote: QuoteRequest) => {
    setSelectedQuote(quote);
    setQuoteAmount(quote.customQuoteAmount?.toString() || '');
    setQuoteNotes(quote.quoteNotes || '');
  };

  const handleSubmitQuote = async () => {
    setIsSubmitting(true);
    try {
      await submitQuoteMutation.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: QuoteRequest['status']) => {
    switch (status) {
      case 'pending_review':
        return 'bg-yellow-500';
      case 'quoted':
        return 'bg-blue-500';
      case 'approved':
        return 'bg-green-500';
      case 'declined':
        return 'bg-red-500';
      case 'completed':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: QuoteRequest['status']) => {
    switch (status) {
      case 'pending_review':
        return <Clock className="w-4 h-4" />;
      case 'quoted':
        return <FileText className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'declined':
        return <XCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const pendingQuotes = pendingData?.quotes || [];
  const allQuotes = quotesData?.quotes || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2" data-testid="page-title">
            Specialty Quote Requests
          </h1>
          <p className="text-muted-foreground">
            Review and price specialty jobs requiring custom quotes
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-pending">
                {pendingQuotes.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Awaiting Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-quoted">
                {allQuotes.filter(q => q.status === 'quoted').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-approved">
                {allQuotes.filter(q => q.status === 'approved').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-completed">
                {allQuotes.filter(q => q.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending Review ({pendingQuotes.length})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">
              All Quotes ({allQuotes.length})
            </TabsTrigger>
          </TabsList>

          {/* Pending Quotes Tab */}
          <TabsContent value="pending">
            {loadingPending ? (
              <Card>
                <CardContent className="p-8">
                  <p className="text-center text-muted-foreground">Loading pending quotes...</p>
                </CardContent>
              </Card>
            ) : pendingQuotes.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <p className="text-center text-muted-foreground">No pending quotes to review</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingQuotes.map((quote) => (
                  <Card
                    key={quote.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleSelectQuote(quote)}
                    data-testid={`quote-card-${quote.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5" />
                            {quote.customerName}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              {quote.phone}
                            </div>
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(quote.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(quote.status)}
                            {quote.status.replace('_', ' ')}
                          </div>
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Damage Type</p>
                          <Badge variant="outline">{quote.damageType}</Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Description</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {quote.issueDescription}
                          </p>
                        </div>
                        {quote.photoUrls.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ImageIcon className="w-4 h-4" />
                            {quote.photoUrls.length} photo{quote.photoUrls.length !== 1 ? 's' : ''} attached
                          </div>
                        )}
                        {quote.thirdPartyPayerName && (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <p className="text-sm text-orange-600 dark:text-orange-400">
                              Third-party payer: {quote.thirdPartyPayerName}
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Submitted {format(new Date(quote.createdAt), 'MMM d, yyyy \'at\' h:mm a')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* All Quotes Tab */}
          <TabsContent value="all">
            {loadingQuotes ? (
              <Card>
                <CardContent className="p-8">
                  <p className="text-center text-muted-foreground">Loading all quotes...</p>
                </CardContent>
              </Card>
            ) : allQuotes.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <p className="text-center text-muted-foreground">No quotes found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {allQuotes.map((quote) => (
                  <Card
                    key={quote.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleSelectQuote(quote)}
                    data-testid={`quote-card-${quote.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5" />
                            {quote.customerName}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              {quote.phone}
                            </div>
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(quote.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(quote.status)}
                            {quote.status.replace('_', ' ')}
                          </div>
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Damage Type</p>
                          <Badge variant="outline">{quote.damageType}</Badge>
                        </div>
                        {quote.customQuoteAmount && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                              ${quote.customQuoteAmount.toFixed(2)}
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Submitted {format(new Date(quote.createdAt), 'MMM d, yyyy \'at\' h:mm a')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Quote Detail Dialog */}
      <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && setSelectedQuote(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Quote Request Details
            </DialogTitle>
            <DialogDescription>
              Review the job details and provide a custom quote
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-6 py-4">
              {/* Customer Info */}
              <div>
                <h3 className="font-semibold mb-3">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedQuote.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedQuote.phone}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Job Details */}
              <div>
                <h3 className="font-semibold mb-3">Job Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Damage Type</p>
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {selectedQuote.damageType}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="text-sm bg-muted p-3 rounded-md">
                      {selectedQuote.issueDescription}
                    </p>
                  </div>
                </div>
              </div>

              {/* Photos */}
              {selectedQuote.photoUrls.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" />
                      Photos ({selectedQuote.photoUrls.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedQuote.photoUrls.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-75 transition-opacity"
                          data-testid={`photo-${index}`}
                        >
                          <img
                            src={url}
                            alt={`Damage photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Third-Party Info */}
              {selectedQuote.thirdPartyPayerName && (
                <>
                  <Separator />
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Third-Party Payer
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedQuote.thirdPartyPayerName}</p>
                      </div>
                      {selectedQuote.thirdPartyPayerEmail && (
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium">{selectedQuote.thirdPartyPayerEmail}</p>
                        </div>
                      )}
                      {selectedQuote.thirdPartyPayerPhone && (
                        <div>
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="font-medium">{selectedQuote.thirdPartyPayerPhone}</p>
                        </div>
                      )}
                      {selectedQuote.poNumber && (
                        <div>
                          <p className="text-sm text-muted-foreground">PO Number</p>
                          <p className="font-medium">{selectedQuote.poNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* AI Pricing Suggestions */}
              <Separator />
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  AI Pricing Suggestions
                </h3>
                {loadingSuggestions ? (
                  <p className="text-sm text-muted-foreground">Loading pricing data...</p>
                ) : suggestionsData?.suggestions ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Minimum
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">
                            {suggestionsData.suggestions.minPrice 
                              ? `$${suggestionsData.suggestions.minPrice.toFixed(2)}`
                              : 'N/A'}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Average
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {suggestionsData.suggestions.avgPrice 
                              ? `$${suggestionsData.suggestions.avgPrice.toFixed(2)}`
                              : 'N/A'}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Maximum
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">
                            {suggestionsData.suggestions.maxPrice 
                              ? `$${suggestionsData.suggestions.maxPrice.toFixed(2)}`
                              : 'N/A'}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {suggestionsData.suggestions.avgTimeSpent && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>Average time: {suggestionsData.suggestions.avgTimeSpent} hours</span>
                      </div>
                    )}

                    {suggestionsData.suggestions.similarJobs.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Similar Jobs</p>
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {suggestionsData.suggestions.similarJobs.map((job) => (
                              <Card key={job.id}>
                                <CardContent className="p-3">
                                  <div className="flex justify-between items-start">
                                    <p className="text-sm text-muted-foreground flex-1 line-clamp-2">
                                      {job.issueDescription}
                                    </p>
                                    <p className="text-sm font-semibold ml-2">
                                      ${job.customQuoteAmount.toFixed(2)}
                                    </p>
                                  </div>
                                  {job.actualTimeSpent && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Time: {job.actualTimeSpent}h | Difficulty: {job.difficultyRating}/5
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No similar jobs found for pricing reference
                  </p>
                )}
              </div>

              {/* Quote Form */}
              {selectedQuote.status === 'pending_review' && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Submit Custom Quote</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="quote-amount">Quote Amount ($)</Label>
                        <Input
                          id="quote-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Enter quote amount"
                          value={quoteAmount}
                          onChange={(e) => setQuoteAmount(e.target.value)}
                          data-testid="input-quote-amount"
                        />
                      </div>
                      <div>
                        <Label htmlFor="quote-notes">Notes (optional)</Label>
                        <Textarea
                          id="quote-notes"
                          placeholder="Add any notes or special instructions..."
                          value={quoteNotes}
                          onChange={(e) => setQuoteNotes(e.target.value)}
                          rows={4}
                          data-testid="input-quote-notes"
                        />
                      </div>
                      <Button
                        onClick={handleSubmitQuote}
                        disabled={isSubmitting || !quoteAmount || parseFloat(quoteAmount) <= 0}
                        className="w-full"
                        data-testid="button-submit-quote"
                      >
                        {isSubmitting ? 'Submitting...' : 'Send Quote to Customer'}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Quote Status Info */}
              {selectedQuote.status !== 'pending_review' && (
                <>
                  <Separator />
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(selectedQuote.status)}
                      <h3 className="font-semibold">
                        Status: {selectedQuote.status.replace('_', ' ')}
                      </h3>
                    </div>
                    {selectedQuote.customQuoteAmount && (
                      <p className="text-sm mb-1">
                        Quote Amount: <span className="font-semibold">${selectedQuote.customQuoteAmount.toFixed(2)}</span>
                      </p>
                    )}
                    {selectedQuote.quoteNotes && (
                      <p className="text-sm text-muted-foreground">
                        Notes: {selectedQuote.quoteNotes}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
