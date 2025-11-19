import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  CheckCircle, 
  DollarSign, 
  CreditCard, 
  Wallet, 
  FileText, 
  Gift,
  Plus,
  Search,
  X,
  Receipt,
  Send,
  CheckCheck
} from 'lucide-react';
import { format } from 'date-fns';

interface Service {
  id: number;
  name: string;
  priceRange: string;
  price?: number;
}

interface Job {
  id: number;
  customerId: number;
  serviceId: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  scheduledTime: string;
}

interface JobCompletionDialogProps {
  job: Job;
  onClose: () => void;
  onComplete: () => void;
}

export function JobCompletionDialog({ job, onClose, onComplete }: JobCompletionDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<number[]>([job.serviceId]);
  const [servicePrices, setServicePrices] = useState<Record<number, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash' | 'check' | 'free' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddServices, setShowAddServices] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [checkAmount, setCheckAmount] = useState('');
  const { toast } = useToast();

  // Fetch all available services
  const { data: servicesData, isLoading: isLoadingServices } = useQuery<{ success: boolean; services: Service[] }>({
    queryKey: ['/api/services'],
  });

  // Fetch add-on services
  const { data: addonsData, isLoading: isLoadingAddons } = useQuery<{ success: boolean; addons: Service[] }>({
    queryKey: ['/api/addon-services'],
  });

  const allServices = servicesData?.services || [];
  const addonServices = addonsData?.addons || [];

  // Extract base price from price range (e.g., "$50-$100" -> 50)
  const extractBasePrice = (priceRange: string): number => {
    if (!priceRange) return 0;
    const match = priceRange.match(/\$?(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  // Initialize service prices when services are loaded
  useEffect(() => {
    if (allServices.length > 0 && selectedServices.length > 0) {
      const initialPrices: Record<number, number> = {};
      selectedServices.forEach(serviceId => {
        if (!servicePrices[serviceId]) {
          const service = allServices.find(s => s.id === serviceId);
          if (service) {
            initialPrices[serviceId] = extractBasePrice(service.priceRange);
          }
        }
      });
      if (Object.keys(initialPrices).length > 0) {
        setServicePrices(prev => ({ ...prev, ...initialPrices }));
      }
    }
  }, [allServices, selectedServices]);

  // Calculate totals
  const subtotal = Object.values(servicePrices).reduce((sum, price) => sum + (price || 0), 0);
  const taxRate = 0; // No tax for now - can be fetched from business settings
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  // Complete job mutation
  const completeJobMutation = useMutation({
    mutationFn: async ({ method, amount, services }: { method: string; amount: number; services: any[] }) => {
      // If online payment, send invoice first
      if (method === 'online') {
        const serviceNames = services.map(s => `${s.name} ($${s.price.toFixed(2)})`).join(', ');
        await apiRequest('POST', '/api/dashboard/send-invoice', {
          customerPhone: job.customerPhone,
          customerEmail: job.customerEmail || '',
          customerName: job.customerName,
          amount: total,
          service: serviceNames,
          notes: `Itemized services: ${services.map(s => `${s.name}: $${s.price.toFixed(2)}`).join(' | ')}`,
        });
      }

      // Complete the job with payment details
      return await apiRequest('POST', `/api/tech/jobs/${job.id}/complete`, {
        paymentMethod: method, 
        amount,
        servicesPerformed: services,
      });
    },
    onSuccess: () => {
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/tech/jobs/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tech-deposits/today'] });

      // Move to completion step
      setStep(5);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete job',
        variant: 'destructive',
      });
    },
  });

  const validatePricing = () => {
    // Ensure at least one service selected
    if (selectedServices.length === 0) {
      toast({
        title: 'No Services Selected',
        description: 'Please select at least one service to complete the job.',
        variant: 'destructive'
      });
      return false;
    }
    
    // Ensure all selected services have valid prices
    for (const serviceId of selectedServices) {
      const price = servicePrices[serviceId];
      if (price === undefined || price === null || isNaN(price) || price < 0) {
        toast({
          title: 'Invalid Price',
          description: 'Please enter a valid price (0 or greater) for all services.',
          variant: 'destructive'
        });
        return false;
      }
    }
    
    return true; // Allow $0 totals at this step - payment method validated later
  };

  const validatePaymentTotal = () => {
    // Validate that $0 totals only work with 'free' payment method
    if (paymentMethod !== 'free' && total === 0) {
      toast({
        title: 'Invalid Total',
        description: 'Total amount must be greater than $0 for this payment method. Use "Free" payment method for $0 jobs.',
        variant: 'destructive'
      });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    // Validation for each step
    if (step === 1 && selectedServices.length === 0) {
      toast({
        title: 'No Services Selected',
        description: 'Please select at least one service',
        variant: 'destructive',
      });
      return;
    }

    if (step === 2) {
      // Comprehensive pricing validation before proceeding
      if (!validatePricing()) {
        return; // Block progression
      }
    }

    if (step === 3 && !paymentMethod) {
      toast({
        title: 'No Payment Method',
        description: 'Please select a payment method',
        variant: 'destructive',
      });
      return;
    }

    if (step === 4) {
      // Validate payment total before processing
      if (!validatePaymentTotal()) {
        return; // Block submission if validation fails
      }

      // Validate cash/check amounts before processing
      if (paymentMethod === 'cash' || paymentMethod === 'check') {
        const amount = paymentMethod === 'cash' ? cashAmount : checkAmount;
        
        // Validate amount exists and is a valid positive number
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
          toast({
            title: 'Invalid Amount',
            description: `Please enter a valid ${paymentMethod} amount greater than $0`,
            variant: 'destructive'
          });
          return; // Block submission
        }
        
        // Validate it matches expected total (allow 1 cent tolerance for rounding)
        if (Math.abs(parseFloat(amount) - total) > 0.01) {
          toast({
            title: 'Amount Mismatch',
            description: `${paymentMethod === 'cash' ? 'Cash' : 'Check'} amount ($${amount}) doesn't match job total ($${total.toFixed(2)})`,
            variant: 'destructive'
          });
          return; // Block submission
        }
      }

      // Process payment
      const servicesPerformed = selectedServices.map(serviceId => {
        const service = allServices.find(s => s.id === serviceId);
        return {
          serviceId,
          serviceName: service?.name || 'Unknown Service',
          price: servicePrices[serviceId] || 0,
        };
      });

      let finalAmount = total;
      if (paymentMethod === 'cash' && cashAmount) {
        finalAmount = parseFloat(cashAmount);
      } else if (paymentMethod === 'check' && checkAmount) {
        finalAmount = parseFloat(checkAmount);
      } else if (paymentMethod === 'free') {
        finalAmount = 0;
      }

      completeJobMutation.mutate({
        method: paymentMethod || 'cash',
        amount: finalAmount,
        services: servicesPerformed,
      });
      return; // Don't increment step - mutation will do it on success
    }

    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  const handleToggleService = (serviceId: number) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        // Don't allow removing the original service
        if (serviceId === job.serviceId) return prev;
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const handleSetPrice = (serviceId: number, price: number) => {
    setServicePrices(prev => ({ ...prev, [serviceId]: price }));
  };

  const handleSetFree = (serviceId: number) => {
    setServicePrices(prev => ({ ...prev, [serviceId]: 0 }));
  };

  const filteredAddons = addonServices.filter(addon => 
    addon.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAllServices = allServices.filter(service => 
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedServices.includes(service.id)
  );

  // Step 1: Service Review
  const renderServiceReviewStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Originally Scheduled Service
        </h3>
        <div className="space-y-2">
          {allServices
            .filter(s => s.id === job.serviceId)
            .map(service => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={true}
                    disabled={true}
                    data-testid={`checkbox-service-${service.id}`}
                  />
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.priceRange}</p>
                  </div>
                </div>
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            ))}
        </div>
      </div>

      {addonServices.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Add-On Services (Optional)
          </h3>
          <div className="space-y-2">
            {addonServices.map(addon => (
              <div
                key={addon.id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedServices.includes(addon.id)
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
                onClick={() => handleToggleService(addon.id)}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedServices.includes(addon.id)}
                    data-testid={`checkbox-addon-${addon.id}`}
                  />
                  <div>
                    <p className="font-medium">{addon.name}</p>
                    <p className="text-sm text-muted-foreground">{addon.priceRange}</p>
                  </div>
                </div>
                {selectedServices.includes(addon.id) && (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <Button
          variant="outline"
          onClick={() => setShowAddServices(!showAddServices)}
          className="w-full"
          data-testid="button-toggle-add-services"
        >
          <Plus className="h-4 w-4 mr-2" />
          {showAddServices ? 'Hide' : 'Add'} Other Services
        </Button>

        {showAddServices && (
          <div className="mt-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-services"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {filteredAllServices.map(service => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                  onClick={() => handleToggleService(service.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox checked={false} />
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-muted-foreground">{service.priceRange}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredAllServices.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No services found
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 border-t">
        <p className="text-sm text-muted-foreground">
          <strong>{selectedServices.length}</strong> service{selectedServices.length !== 1 ? 's' : ''} selected
        </p>
      </div>
    </div>
  );

  // Step 2: Pricing Adjustment
  const renderPricingAdjustmentStep = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        {selectedServices.map(serviceId => {
          const service = allServices.find(s => s.id === serviceId);
          if (!service) return null;

          return (
            <Card key={serviceId}>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Base Price: {service.priceRange}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor={`price-${serviceId}`}>Final Price</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input
                          id={`price-${serviceId}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={servicePrices[serviceId] || ''}
                          onChange={(e) => handleSetPrice(serviceId, parseFloat(e.target.value) || 0)}
                          className="pl-7"
                          placeholder="0.00"
                          data-testid={`input-price-${serviceId}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetFree(serviceId)}
                        data-testid={`button-free-${serviceId}`}
                      >
                        <Gift className="h-4 w-4 mr-1" />
                        Free
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span data-testid="text-subtotal">${subtotal.toFixed(2)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
                <span data-testid="text-tax">${tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span data-testid="text-total">${total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Step 3: Payment Method Selection
  const renderPaymentMethodStep = () => (
    <div className="space-y-4">
      <RadioGroup value={paymentMethod || ''} onValueChange={(value: any) => setPaymentMethod(value)}>
        <div className="grid grid-cols-2 gap-4">
          <div
            className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
              paymentMethod === 'online'
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
            onClick={() => setPaymentMethod('online')}
          >
            <RadioGroupItem value="online" id="online" className="sr-only" />
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={`p-3 rounded-full ${paymentMethod === 'online' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Online Payment</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Send invoice via SMS/email
                </p>
              </div>
            </div>
            {paymentMethod === 'online' && (
              <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-blue-600" />
            )}
          </div>

          <div
            className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
              paymentMethod === 'cash'
                ? 'border-green-600 bg-green-50 dark:bg-green-950'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
            onClick={() => setPaymentMethod('cash')}
          >
            <RadioGroupItem value="cash" id="cash" className="sr-only" />
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={`p-3 rounded-full ${paymentMethod === 'cash' ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Cash</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Payment received in cash
                </p>
              </div>
            </div>
            {paymentMethod === 'cash' && (
              <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-green-600" />
            )}
          </div>

          <div
            className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
              paymentMethod === 'check'
                ? 'border-purple-600 bg-purple-50 dark:bg-purple-950'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
            onClick={() => setPaymentMethod('check')}
          >
            <RadioGroupItem value="check" id="check" className="sr-only" />
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={`p-3 rounded-full ${paymentMethod === 'check' ? 'bg-purple-100 dark:bg-purple-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Check</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Payment received by check
                </p>
              </div>
            </div>
            {paymentMethod === 'check' && (
              <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-purple-600" />
            )}
          </div>

          <div
            className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
              paymentMethod === 'free'
                ? 'border-orange-600 bg-orange-50 dark:bg-orange-950'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
            onClick={() => setPaymentMethod('free')}
          >
            <RadioGroupItem value="free" id="free" className="sr-only" />
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={`p-3 rounded-full ${paymentMethod === 'free' ? 'bg-orange-100 dark:bg-orange-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Free / Promo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No payment required
                </p>
              </div>
            </div>
            {paymentMethod === 'free' && (
              <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-orange-600" />
            )}
          </div>
        </div>
      </RadioGroup>

      {paymentMethod && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <p className="text-sm">
              {paymentMethod === 'online' && (
                <>
                  <strong>Online Payment:</strong> An itemized invoice will be sent to {job.customerName} via SMS
                  {job.customerEmail ? ' and email' : ''}. The customer can pay using their credit/debit card.
                </>
              )}
              {paymentMethod === 'cash' && (
                <>
                  <strong>Cash Payment:</strong> Record the cash amount received from the customer. This will be added to your daily deposit total.
                </>
              )}
              {paymentMethod === 'check' && (
                <>
                  <strong>Check Payment:</strong> Record the check amount and number. This will be added to your daily deposit total.
                </>
              )}
              {paymentMethod === 'free' && (
                <>
                  <strong>Free Service:</strong> This service will be marked as completed with no payment required (promotional or warranty work).
                </>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Step 4: Payment Processing
  const renderPaymentProcessingStep = () => (
    <div className="space-y-4">
      {paymentMethod === 'online' && (
        <div className="space-y-4">
          {!completeJobMutation.isPending && !completeJobMutation.isSuccess && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send Invoice
                </CardTitle>
                <CardDescription>
                  Invoice will be sent to {job.customerName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium">{job.customerPhone}</span>
                </div>
                {job.customerEmail && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{job.customerEmail}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-bold text-lg">${total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {completeJobMutation.isPending && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                  <div>
                    <p className="font-semibold">Sending Invoice...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Please wait while we generate and send the invoice
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(paymentMethod === 'cash' || paymentMethod === 'check') && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {paymentMethod === 'cash' ? 'Cash' : 'Check'} Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="payment-amount">Amount Received</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentMethod === 'cash' ? cashAmount : checkAmount}
                    onChange={(e) => paymentMethod === 'cash' ? setCashAmount(e.target.value) : setCheckAmount(e.target.value)}
                    className="pl-7"
                    placeholder={total.toFixed(2)}
                    data-testid="input-payment-amount"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected amount: ${total.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {paymentMethod === 'free' && (
        <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 bg-orange-100 dark:bg-orange-900 rounded-full">
                <Gift className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-semibold">Promotional Service</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This service will be marked as completed with no payment required
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Step 5: Completion Summary
  const renderCompletionSummaryStep = () => {
    const servicesPerformed = selectedServices.map(serviceId => {
      const service = allServices.find(s => s.id === serviceId);
      return {
        name: service?.name || 'Unknown Service',
        price: servicePrices[serviceId] || 0,
      };
    });

    return (
      <div className="space-y-4">
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                <CheckCheck className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">
                  Job Completed!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(), 'PPpp')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium" data-testid="text-summary-customer">{job.customerName}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Services Performed</p>
              <ul className="space-y-1">
                {servicesPerformed.map((service, index) => (
                  <li key={index} className="flex justify-between text-sm">
                    <span>• {service.name}</span>
                    <span className="font-medium">${service.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t">
              <div className="flex justify-between">
                <span className="font-semibold">Total Amount</span>
                <span className="font-bold text-lg" data-testid="text-summary-total">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <span className="font-medium capitalize" data-testid="text-summary-payment">
                  {paymentMethod === 'online' ? 'Online Payment (Invoice Sent)' : 
                   paymentMethod === 'cash' ? 'Cash' :
                   paymentMethod === 'check' ? 'Check' :
                   'Free / Promotional'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Complete Job - Step {step} of 5
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Review and select services performed'}
            {step === 2 && 'Set final pricing for each service'}
            {step === 3 && 'Choose payment method'}
            {step === 4 && 'Process payment'}
            {step === 5 && 'Job completion summary'}
          </DialogDescription>
          <Progress value={(step / 5) * 100} className="mt-2" />
        </DialogHeader>

        <div className="py-4">
          {step === 1 && renderServiceReviewStep()}
          {step === 2 && renderPricingAdjustmentStep()}
          {step === 3 && renderPaymentMethodStep()}
          {step === 4 && renderPaymentProcessingStep()}
          {step === 5 && renderCompletionSummaryStep()}
        </div>

        <DialogFooter className="flex gap-2">
          {step > 1 && step < 5 && (
            <Button
              variant="outline"
              onClick={handlePrevStep}
              disabled={completeJobMutation.isPending}
              data-testid="button-back"
            >
              Back
            </Button>
          )}
          
          {step < 4 && (
            <Button
              onClick={handleNextStep}
              disabled={isLoadingServices || isLoadingAddons}
              data-testid="button-next"
            >
              {isLoadingServices || isLoadingAddons ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Next'
              )}
            </Button>
          )}

          {step === 4 && !completeJobMutation.isSuccess && (
            <Button
              onClick={handleNextStep}
              disabled={completeJobMutation.isPending}
              data-testid="button-process-payment"
            >
              {completeJobMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  {paymentMethod === 'online' ? 'Send Invoice' : 'Complete Job'}
                </>
              )}
            </Button>
          )}

          {step === 5 && (
            <Button
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="w-full"
              data-testid="button-done"
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
