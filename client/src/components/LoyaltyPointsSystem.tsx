import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { Loader2, Trophy, Gift, Settings, Users, BarChart, Plus, Edit, Trash, Award, Star, Calendar, Zap } from 'lucide-react';

// Schema for adding points
const addPointsSchema = z.object({
  customerId: z.number({
    required_error: "Customer is required",
  }),
  points: z.number({
    required_error: "Points are required",
  }).min(1, "Points must be at least 1"),
  source: z.string({
    required_error: "Source is required",
  }),
  description: z.string().optional(),
});

// Schema for reward service
const rewardServiceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  pointCost: z.number().min(1, "Point cost must be at least 1"),
  tier: z.enum(["tier_500", "tier_1000", "tier_2000", "tier_5000"], {
    required_error: "Tier is required",
  }),
  active: z.boolean().default(true),
});

// Schema for achievement
const achievementSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  pointValue: z.number().min(0, "Point value must be at least 0"),
  criteria: z.string().min(1, "Criteria is required"),
  level: z.number().min(1, "Level must be at least 1"),
  icon: z.string().optional(),
});

// Types for loyalty data
interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  vehicleInfo?: string;
  loyaltyProgramOptIn: boolean;
  loyaltyProgramJoinDate?: string;
}

interface LoyaltyPoints {
  id: number;
  customerId: number;
  points: number;
  lastUpdated: string;
  expiryDate?: string;
  customer?: Customer;
}

interface PointsTransaction {
  id: number;
  loyaltyPointsId: number;
  amount: number;
  description: string;
  transactionDate: string;
  transactionType: 'earn' | 'redeem';
  source: string;
  sourceId?: number;
  expiryDate?: string;
}

interface LoyaltyTier {
  id: number;
  name: string;
  description: string;
  pointThreshold: number;
  benefits: string[];
  icon?: string;
}

interface Achievement {
  id: number;
  name: string;
  description: string;
  pointValue: number;
  criteria: string;
  level: number;
  icon?: string;
}

interface CustomerAchievement {
  id: number;
  customerId: number;
  achievementId: number;
  dateEarned: string;
  notified: boolean;
  achievement: Achievement;
  customer: Customer;
}

interface RewardService {
  id: number;
  name: string;
  description: string;
  pointCost: number;
  tier: string;
  active: boolean;
}

interface RedeemedReward {
  id: number;
  customerId: number;
  rewardServiceId: number;
  pointsSpent: number;
  redeemedDate: string;
  status: 'pending' | 'scheduled' | 'completed' | 'expired';
  appointmentId?: number;
  expiryDate?: string;
  customer: Customer;
  rewardService: RewardService;
}

export function LoyaltyPointsSystem() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("customers");
  
  // Dialog states
  const [isAddPointsDialogOpen, setIsAddPointsDialogOpen] = useState(false);
  const [isRewardServiceDialogOpen, setIsRewardServiceDialogOpen] = useState(false);
  const [isAchievementDialogOpen, setIsAchievementDialogOpen] = useState(false);
  const [isCustomerDetailDialogOpen, setIsCustomerDetailDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedLoyaltyPoints, setSelectedLoyaltyPoints] = useState<LoyaltyPoints | null>(null);
  const [selectedRewardService, setSelectedRewardService] = useState<RewardService | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  
  // Forms setup
  const addPointsForm = useForm<z.infer<typeof addPointsSchema>>({
    resolver: zodResolver(addPointsSchema),
    defaultValues: {
      points: 0,
      source: 'manual',
      description: 'Manual points adjustment',
    },
  });
  
  const rewardServiceForm = useForm<z.infer<typeof rewardServiceSchema>>({
    resolver: zodResolver(rewardServiceSchema),
    defaultValues: {
      name: '',
      description: '',
      pointCost: 500,
      tier: 'tier_500',
      active: true,
    },
  });
  
  const achievementForm = useForm<z.infer<typeof achievementSchema>>({
    resolver: zodResolver(achievementSchema),
    defaultValues: {
      name: '',
      description: '',
      pointValue: 100,
      criteria: '',
      level: 1,
      icon: 'trophy',
    },
  });
  
  // Queries
  const { data: customers, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['/api/loyalty/customers'],
    queryFn: async () => {
      const response = await fetch('/api/loyalty/customers');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      return data.customers as Customer[];
    },
  });
  
  const { data: loyaltyPoints, isLoading: isLoadingLoyaltyPoints } = useQuery({
    queryKey: ['/api/loyalty/points'],
    queryFn: async () => {
      const response = await fetch('/api/loyalty/points');
      if (!response.ok) throw new Error('Failed to fetch loyalty points');
      const data = await response.json();
      return data.loyaltyPoints as LoyaltyPoints[];
    },
  });
  
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['/api/loyalty/transactions'],
    queryFn: async () => {
      const response = await fetch('/api/loyalty/transactions');
      if (!response.ok) throw new Error('Failed to fetch transactions');
      const data = await response.json();
      return data.transactions as PointsTransaction[];
    },
  });
  
  const { data: tiers, isLoading: isLoadingTiers } = useQuery({
    queryKey: ['/api/loyalty/tiers'],
    queryFn: async () => {
      const response = await fetch('/api/loyalty/tiers');
      if (!response.ok) throw new Error('Failed to fetch loyalty tiers');
      const data = await response.json();
      return data.tiers as LoyaltyTier[];
    },
  });
  
  const { data: achievements, isLoading: isLoadingAchievements } = useQuery({
    queryKey: ['/api/loyalty/achievements'],
    queryFn: async () => {
      const response = await fetch('/api/loyalty/achievements');
      if (!response.ok) throw new Error('Failed to fetch achievements');
      const data = await response.json();
      return data.achievements as Achievement[];
    },
  });
  
  const { data: customerAchievements, isLoading: isLoadingCustomerAchievements } = useQuery({
    queryKey: ['/api/loyalty/customer-achievements'],
    queryFn: async () => {
      const response = await fetch('/api/loyalty/customer-achievements');
      if (!response.ok) throw new Error('Failed to fetch customer achievements');
      const data = await response.json();
      return data.customerAchievements as CustomerAchievement[];
    },
  });
  
  const { data: rewardServices, isLoading: isLoadingRewardServices } = useQuery({
    queryKey: ['/api/loyalty/reward-services'],
    queryFn: async () => {
      const response = await fetch('/api/loyalty/reward-services');
      if (!response.ok) throw new Error('Failed to fetch reward services');
      const data = await response.json();
      return data.rewardServices as RewardService[];
    },
  });
  
  const { data: redeemedRewards, isLoading: isLoadingRedeemedRewards } = useQuery({
    queryKey: ['/api/loyalty/redeemed-rewards'],
    queryFn: async () => {
      const response = await fetch('/api/loyalty/redeemed-rewards');
      if (!response.ok) throw new Error('Failed to fetch redeemed rewards');
      const data = await response.json();
      return data.redeemedRewards as RedeemedReward[];
    },
  });
  
  // Mutations
  const addPointsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addPointsSchema>) => {
      return await apiRequest('/api/loyalty/add-points', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Points added successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/points'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/transactions'] });
      setIsAddPointsDialogOpen(false);
      addPointsForm.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to add points: ${error.message}`,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });
  
  const createRewardServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof rewardServiceSchema>) => {
      return await apiRequest('/api/loyalty/reward-services', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Reward service created successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/reward-services'] });
      setIsRewardServiceDialogOpen(false);
      rewardServiceForm.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create reward service: ${error.message}`,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });
  
  const updateRewardServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof rewardServiceSchema> }) => {
      return await apiRequest(`/api/loyalty/reward-services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Reward service updated successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/reward-services'] });
      setIsRewardServiceDialogOpen(false);
      setSelectedRewardService(null);
      rewardServiceForm.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update reward service: ${error.message}`,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });
  
  const createAchievementMutation = useMutation({
    mutationFn: async (data: z.infer<typeof achievementSchema>) => {
      return await apiRequest('/api/loyalty/achievements', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Achievement created successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/achievements'] });
      setIsAchievementDialogOpen(false);
      achievementForm.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create achievement: ${error.message}`,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });
  
  const updateAchievementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof achievementSchema> }) => {
      return await apiRequest(`/api/loyalty/achievements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Achievement updated successfully',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/achievements'] });
      setIsAchievementDialogOpen(false);
      setSelectedAchievement(null);
      achievementForm.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update achievement: ${error.message}`,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });
  
  // Helper functions
  const handleOpenAddPointsDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    addPointsForm.setValue('customerId', customer.id);
    setIsAddPointsDialogOpen(true);
  };
  
  const handleAddPoints = (data: z.infer<typeof addPointsSchema>) => {
    addPointsMutation.mutate(data);
  };
  
  const handleOpenRewardServiceDialog = (service: RewardService | null = null) => {
    if (service) {
      setSelectedRewardService(service);
      rewardServiceForm.reset({
        name: service.name,
        description: service.description,
        pointCost: service.pointCost,
        tier: service.tier as any,
        active: service.active,
      });
    } else {
      setSelectedRewardService(null);
      rewardServiceForm.reset({
        name: '',
        description: '',
        pointCost: 500,
        tier: 'tier_500',
        active: true,
      });
    }
    setIsRewardServiceDialogOpen(true);
  };
  
  const handleRewardServiceSubmit = (data: z.infer<typeof rewardServiceSchema>) => {
    if (selectedRewardService) {
      updateRewardServiceMutation.mutate({ id: selectedRewardService.id, data });
    } else {
      createRewardServiceMutation.mutate(data);
    }
  };
  
  const handleOpenAchievementDialog = (achievement: Achievement | null = null) => {
    if (achievement) {
      setSelectedAchievement(achievement);
      achievementForm.reset({
        name: achievement.name,
        description: achievement.description,
        pointValue: achievement.pointValue,
        criteria: achievement.criteria,
        level: achievement.level,
        icon: achievement.icon || 'trophy',
      });
    } else {
      setSelectedAchievement(null);
      achievementForm.reset({
        name: '',
        description: '',
        pointValue: 100,
        criteria: '',
        level: 1,
        icon: 'trophy',
      });
    }
    setIsAchievementDialogOpen(true);
  };
  
  const handleAchievementSubmit = (data: z.infer<typeof achievementSchema>) => {
    if (selectedAchievement) {
      updateAchievementMutation.mutate({ id: selectedAchievement.id, data });
    } else {
      createAchievementMutation.mutate(data);
    }
  };
  
  const getCustomerTier = (points: number) => {
    if (!tiers) return null;
    const sortedTiers = [...tiers].sort((a, b) => b.pointThreshold - a.pointThreshold);
    return sortedTiers.find(tier => points >= tier.pointThreshold) || null;
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  const getMostRecentTransactions = () => {
    if (!transactions) return [];
    return [...transactions].sort((a, b) => 
      new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    ).slice(0, 10);
  };

  const getCustomerByLoyaltyPoints = (loyaltyPointsId: number) => {
    if (!loyaltyPoints || !customers) return "Unknown Customer";
    const pointsRecord = loyaltyPoints.find(p => p.id === loyaltyPointsId);
    if (!pointsRecord) return "Unknown Customer";
    const customer = customers.find(c => c.id === pointsRecord.customerId);
    return customer ? customer.name : "Unknown Customer";
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Loyalty Points System</h2>
      </div>
      
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Customers</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            <span>Transactions</span>
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            <span>Loyalty Offers</span>
          </TabsTrigger>
          <TabsTrigger value="achievements" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            <span>Achievements</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loyalty Program Members</CardTitle>
              <CardDescription>
                View and manage customers enrolled in the loyalty program
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCustomers || isLoadingLoyaltyPoints ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : loyaltyPoints && loyaltyPoints.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Join Date</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loyaltyPoints.map((pointsRecord) => {
                      const customer = customers?.find(c => c.id === pointsRecord.customerId);
                      const tier = getCustomerTier(pointsRecord.points);
                      
                      return (
                        <TableRow key={pointsRecord.id}>
                          <TableCell 
                            className="font-medium cursor-pointer hover:text-blue-600"
                            onClick={() => {
                              if (customer) {
                                setSelectedCustomer(customer);
                                setSelectedLoyaltyPoints(pointsRecord);
                                setIsCustomerDetailDialogOpen(true);
                              }
                            }}
                          >
                            {customer ? customer.name : "Unknown Customer"}
                            <div className="text-xs text-gray-500">{customer?.phone}</div>
                          </TableCell>
                          <TableCell>{pointsRecord.points}</TableCell>
                          <TableCell>
                            {tier ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                {tier.name}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50">
                                No Tier
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {customer?.loyaltyProgramJoinDate 
                              ? formatDate(customer.loyaltyProgramJoinDate)
                              : "Unknown"}
                          </TableCell>
                          <TableCell>{formatDate(pointsRecord.lastUpdated)}</TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => customer && handleOpenAddPointsDialog(customer)}
                              disabled={!customer}
                            >
                              Add Points
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No customers enrolled in the loyalty program yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Points Transactions</CardTitle>
              <CardDescription>
                View recent points earning and redemption activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTransactions ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : transactions && transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getMostRecentTransactions().map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {getCustomerByLoyaltyPoints(transaction.loyaltyPointsId)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={transaction.transactionType === 'earn' 
                              ? 'bg-green-50 text-green-700' 
                              : 'bg-purple-50 text-purple-700'
                            }
                          >
                            {transaction.transactionType === 'earn' ? 'Earned' : 'Redeemed'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={transaction.transactionType === 'earn' ? 'text-green-600' : 'text-purple-600'}>
                            {transaction.transactionType === 'earn' ? '+' : '-'}{transaction.amount}
                          </span>
                        </TableCell>
                        <TableCell>{transaction.source}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>{formatDate(transaction.transactionDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No transaction history available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Loyalty Offers Tab */}
        <TabsContent value="rewards" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Loyalty Point Offers</h3>
            <Button 
              onClick={() => handleOpenRewardServiceDialog()}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Loyalty Offer</span>
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoadingRewardServices ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : rewardServices && rewardServices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Point Cost</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewardServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell>{service.description}</TableCell>
                        <TableCell>{service.pointCost}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {service.tier.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={service.active 
                              ? 'bg-green-50 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                            }
                          >
                            {service.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenRewardServiceDialog(service)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No reward services have been created yet.</p>
                  <Button 
                    onClick={() => handleOpenRewardServiceDialog()}
                    variant="outline"
                    className="mt-4"
                  >
                    Add Your First Reward
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Redeemed Loyalty Points</h3>
            <Card>
              <CardContent className="pt-6">
                {isLoadingRedeemedRewards ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : redeemedRewards && redeemedRewards.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Loyalty Offer</TableHead>
                        <TableHead>Points Spent</TableHead>
                        <TableHead>Redeemed Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expiry</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {redeemedRewards.map((reward) => (
                        <TableRow key={reward.id}>
                          <TableCell className="font-medium">
                            {reward.customer?.name || "Unknown Customer"}
                          </TableCell>
                          <TableCell>{reward.rewardService?.name || "Unknown Offer"}</TableCell>
                          <TableCell>{reward.pointsSpent}</TableCell>
                          <TableCell>{formatDate(reward.redeemedDate)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`capitalize ${
                                reward.status === 'completed' ? 'bg-green-50 text-green-700' :
                                reward.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                                reward.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                                'bg-red-50 text-red-700'
                              }`}
                            >
                              {reward.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {reward.expiryDate ? formatDate(reward.expiryDate) : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No rewards have been redeemed yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Achievements</h3>
            <Button 
              onClick={() => handleOpenAchievementDialog()}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Achievement</span>
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoadingAchievements ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : achievements && achievements.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Point Value</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Criteria</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {achievements.map((achievement) => (
                      <TableRow key={achievement.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-amber-500" />
                            <span>{achievement.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{achievement.description}</TableCell>
                        <TableCell>{achievement.pointValue}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {Array.from({ length: achievement.level }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{achievement.criteria}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenAchievementDialog(achievement)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No achievements have been created yet.</p>
                  <Button 
                    onClick={() => handleOpenAchievementDialog()}
                    variant="outline"
                    className="mt-4"
                  >
                    Add Your First Achievement
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Recent Achievement Unlocks</h3>
            <Card>
              <CardContent className="pt-6">
                {isLoadingCustomerAchievements ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : customerAchievements && customerAchievements.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Achievement</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Date Earned</TableHead>
                        <TableHead>Notified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerAchievements.slice(0, 10).map((ca) => (
                        <TableRow key={ca.id}>
                          <TableCell className="font-medium">
                            {ca.customer?.name || "Unknown Customer"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Award className="h-4 w-4 text-amber-500" />
                              <span>{ca.achievement?.name || "Unknown Achievement"}</span>
                            </div>
                          </TableCell>
                          <TableCell>+{ca.achievement?.pointValue || 0}</TableCell>
                          <TableCell>{formatDate(ca.dateEarned)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={ca.notified 
                                ? 'bg-green-50 text-green-700' 
                                : 'bg-yellow-50 text-yellow-700'
                              }
                            >
                              {ca.notified ? 'Notified' : 'Pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No achievements have been unlocked yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Add Points Dialog */}
      <Dialog open={isAddPointsDialogOpen} onOpenChange={setIsAddPointsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Points to Customer</DialogTitle>
            <DialogDescription>
              {selectedCustomer && (
                <span>Add loyalty points to {selectedCustomer.name}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...addPointsForm}>
            <form onSubmit={addPointsForm.handleSubmit(handleAddPoints)} className="space-y-4">
              <FormField
                control={addPointsForm.control}
                name="points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Points</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addPointsForm.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual Adjustment</SelectItem>
                        <SelectItem value="referral">Referral Bonus</SelectItem>
                        <SelectItem value="appointment">Appointment Completion</SelectItem>
                        <SelectItem value="review">Customer Review</SelectItem>
                        <SelectItem value="promotion">Special Promotion</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addPointsForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Brief description of why points are being added
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddPointsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addPointsMutation.isPending}>
                  {addPointsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Points'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Reward Service Dialog */}
      <Dialog open={isRewardServiceDialogOpen} onOpenChange={setIsRewardServiceDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedRewardService ? 'Edit Reward Service' : 'Create Reward Service'}
            </DialogTitle>
            <DialogDescription>
              {selectedRewardService 
                ? 'Modify the details of this reward service'
                : 'Create a new reward service for your loyalty program'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...rewardServiceForm}>
            <form onSubmit={rewardServiceForm.handleSubmit(handleRewardServiceSubmit)} className="space-y-4">
              <FormField
                control={rewardServiceForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={rewardServiceForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={rewardServiceForm.control}
                  name="pointCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Point Cost</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={rewardServiceForm.control}
                  name="tier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tier</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="tier_500">Tier 500</SelectItem>
                          <SelectItem value="tier_1000">Tier 1000</SelectItem>
                          <SelectItem value="tier_2000">Tier 2000</SelectItem>
                          <SelectItem value="tier_5000">Tier 5000</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={rewardServiceForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Make this reward available to customers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="w-4 h-4"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRewardServiceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createRewardServiceMutation.isPending || updateRewardServiceMutation.isPending}
                >
                  {createRewardServiceMutation.isPending || updateRewardServiceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : selectedRewardService ? (
                    'Update Reward'
                  ) : (
                    'Create Reward'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Achievement Dialog */}
      <Dialog open={isAchievementDialogOpen} onOpenChange={setIsAchievementDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedAchievement ? 'Edit Achievement' : 'Create Achievement'}
            </DialogTitle>
            <DialogDescription>
              {selectedAchievement 
                ? 'Modify the details of this achievement'
                : 'Create a new achievement for your loyalty program'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...achievementForm}>
            <form onSubmit={achievementForm.handleSubmit(handleAchievementSubmit)} className="space-y-4">
              <FormField
                control={achievementForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Achievement Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={achievementForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={achievementForm.control}
                  name="pointValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Point Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Points awarded when achievement is unlocked
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={achievementForm.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          step="1"
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Achievement difficulty (1-5)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={achievementForm.control}
                name="criteria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Criteria</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      How customers can unlock this achievement
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={achievementForm.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="trophy">Trophy</SelectItem>
                        <SelectItem value="star">Star</SelectItem>
                        <SelectItem value="award">Award</SelectItem>
                        <SelectItem value="gift">Gift</SelectItem>
                        <SelectItem value="calendar">Calendar</SelectItem>
                        <SelectItem value="zap">Lightning</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAchievementDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAchievementMutation.isPending || updateAchievementMutation.isPending}
                >
                  {createAchievementMutation.isPending || updateAchievementMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : selectedAchievement ? (
                    'Update Achievement'
                  ) : (
                    'Create Achievement'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={isCustomerDetailDialogOpen} onOpenChange={setIsCustomerDetailDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Customer Loyalty Profile</DialogTitle>
            <DialogDescription>
              {selectedCustomer && `Viewing loyalty program details for ${selectedCustomer.name}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && selectedLoyaltyPoints && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Contact Information</h3>
                  <div className="mt-2">
                    <p><span className="font-medium">Name:</span> {selectedCustomer.name}</p>
                    <p><span className="font-medium">Phone:</span> {selectedCustomer.phone}</p>
                    <p><span className="font-medium">Email:</span> {selectedCustomer.email || 'Not provided'}</p>
                    <p><span className="font-medium">Vehicle:</span> {selectedCustomer.vehicle_info || 'Not specified'}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Loyalty Status</h3>
                  <div className="mt-2">
                    <p><span className="font-medium">Points Balance:</span> <span className="text-lg font-bold text-blue-600">{selectedLoyaltyPoints.points}</span></p>
                    <p>
                      <span className="font-medium">Current Tier:</span> {' '}
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {getCustomerTier(selectedLoyaltyPoints.points)?.name || 'No Tier'}
                      </Badge>
                    </p>
                    <p><span className="font-medium">Member Since:</span> {formatDate(selectedCustomer.loyaltyProgramJoinDate || new Date())}</p>
                    <p><span className="font-medium">Points Expiry:</span> {formatDate(selectedLoyaltyPoints.expiryDate || new Date())}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Recent Transactions</h3>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions?.filter(tx => tx.loyaltyPointsId === selectedLoyaltyPoints.id)
                        .slice(0, 5)
                        .map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>{formatDate(tx.transactionDate)}</TableCell>
                            <TableCell>{tx.description}</TableCell>
                            <TableCell className={tx.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                              {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                            </TableCell>
                            <TableCell>
                              <Badge variant={tx.transactionType === 'earn' ? 'default' : 'outline'}>
                                {tx.transactionType === 'earn' ? 'Earned' : 'Redeemed'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      {(!transactions || transactions.filter(tx => tx.loyaltyPointsId === selectedLoyaltyPoints.id).length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Available Rewards</h3>
                <div className="border rounded-md p-4">
                  {rewardServices?.filter(reward => reward.pointCost <= selectedLoyaltyPoints.points).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {rewardServices?.filter(reward => reward.pointCost <= selectedLoyaltyPoints.points)
                        .map(reward => (
                          <div key={reward.id} className="border rounded-md p-3 bg-blue-50">
                            <h4 className="font-medium">{reward.name}</h4>
                            <p className="text-sm text-gray-600">{reward.description}</p>
                            <div className="flex justify-between items-center mt-2">
                              <Badge>{reward.pointCost} points</Badge>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  // Redirect to booking page with pre-selected service
                                  window.location.href = `/booking?service=${encodeURIComponent(reward.name)}&redeem=true&customerId=${selectedCustomer.id}&rewardId=${reward.id}`;
                                }}
                              >
                                Schedule & Redeem
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      No rewards available at current point level
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  onClick={() => selectedCustomer && handleOpenAddPointsDialog(selectedCustomer)}
                  variant="outline"
                >
                  Add Points
                </Button>
                <Button 
                  onClick={() => setIsCustomerDetailDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}