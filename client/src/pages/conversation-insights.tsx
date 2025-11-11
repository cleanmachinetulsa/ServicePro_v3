import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Home, 
  BarChart2, 
  TrendingUp, 
  Clock, 
  PieChart, 
  ThumbsUp, 
  ThumbsDown,
  MessageSquare,
  Calendar,
  Users,
  Search,
  Filter,
  Download
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface CategoryCount {
  category: string;
  count: number;
  color: string;
}

interface TopicCount {
  topic: string;
  count: number;
}

interface DailyData {
  date: string;
  conversations: number;
  messages: number;
  newCustomers: number;
}

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
}

interface ConversationInsight {
  id: string;
  customerName: string;
  date: string;
  duration: number; // minutes
  messageCount: number;
  category: string;
  topics: string[];
  aiResponseRate: number; // in seconds
  customerResponseTime: number; // in seconds
  resolutionTime: number; // in minutes
  sentiment: 'positive' | 'neutral' | 'negative';
  resolved: boolean;
  satisfaction?: number; // optional rating 1-5
}

export default function ConversationInsightsPage() {
  const [location, setLocation] = useLocation();
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [categoryData, setCategoryData] = useState<CategoryCount[]>([]);
  const [topicData, setTopicData] = useState<TopicCount[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentData>({ positive: 0, neutral: 0, negative: 0 });
  const [insights, setInsights] = useState<ConversationInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredInsights, setFilteredInsights] = useState<ConversationInsight[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Metrics
  const [avgResponseTime, setAvgResponseTime] = useState<number>(0);
  const [avgResolutionTime, setAvgResolutionTime] = useState<number>(0);
  const [totalConversations, setTotalConversations] = useState<number>(0);
  const [resolutionRate, setResolutionRate] = useState<number>(0);
  
  // Animation frames for typing indicators
  const [typingFrames] = useState(['', '.', '..', '...']);
  const [typingFrame, setTypingFrame] = useState(0);
  
  // Simulate typing animation
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingFrame((prev) => (prev + 1) % typingFrames.length);
    }, 500);
    
    return () => clearInterval(interval);
  }, [typingFrames]);
  
  // Fetch insights data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      // In a real application, you would fetch from your API
      // This is just mock data for demonstration
      setTimeout(() => {
        // Generate mock category data
        const mockCategoryData: CategoryCount[] = [
          { category: 'Booking', count: 42, color: '#3b82f6' },
          { category: 'Inquiry', count: 28, color: '#10b981' },
          { category: 'Support', count: 17, color: '#f59e0b' },
          { category: 'Feedback', count: 13, color: '#8b5cf6' },
          { category: 'Other', count: 8, color: '#6b7280' }
        ];
        
        // Generate mock topic data
        const mockTopicData: TopicCount[] = [
          { topic: 'Pricing', count: 35 },
          { topic: 'Scheduling', count: 30 },
          { topic: 'Services', count: 25 },
          { topic: 'Cancellation', count: 15 },
          { topic: 'Location', count: 12 },
          { topic: 'Payment', count: 10 },
          { topic: 'Special Requests', count: 8 },
          { topic: 'Hours', count: 5 }
        ];
        
        // Generate mock daily data for the past 7 days
        const mockDailyData: DailyData[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          mockDailyData.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            conversations: Math.floor(Math.random() * 15) + 5,
            messages: Math.floor(Math.random() * 80) + 20,
            newCustomers: Math.floor(Math.random() * 8) + 1
          });
        }
        
        // Generate mock sentiment data
        const mockSentimentData: SentimentData = {
          positive: 65,
          neutral: 27,
          negative: 8
        };
        
        // Generate mock insights
        const mockInsights: ConversationInsight[] = [];
        const categories = ['Booking', 'Inquiry', 'Support', 'Feedback', 'Other'];
        const sentiments = ['positive', 'neutral', 'negative'];
        const topics = [
          ['Pricing', 'Services'],
          ['Scheduling', 'Availability'],
          ['Cancellation', 'Rescheduling'],
          ['Location', 'Service Area'],
          ['Payment', 'Special Requests'],
          ['Hours', 'Duration'],
          ['Vehicle Types', 'Products Used']
        ];
        
        for (let i = 0; i < 50; i++) {
          const randomTopics = topics[Math.floor(Math.random() * topics.length)];
          const date = new Date();
          date.setDate(date.getDate() - Math.floor(Math.random() * 7));
          
          mockInsights.push({
            id: `insight-${i + 1}`,
            customerName: `Customer ${i + 1}`,
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            duration: Math.floor(Math.random() * 20) + 2,
            messageCount: Math.floor(Math.random() * 15) + 3,
            category: categories[Math.floor(Math.random() * categories.length)],
            topics: randomTopics,
            aiResponseRate: Math.floor(Math.random() * 10) + 1,
            customerResponseTime: Math.floor(Math.random() * 60) + 10,
            resolutionTime: Math.floor(Math.random() * 30) + 5,
            sentiment: sentiments[Math.floor(Math.random() * sentiments.length)] as 'positive' | 'neutral' | 'negative',
            resolved: Math.random() > 0.2,
            satisfaction: Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : undefined
          });
        }
        
        // Calculate metrics
        const calculatedAvgResponse = 
          mockInsights.reduce((sum, insight) => sum + insight.aiResponseRate, 0) / mockInsights.length;
        
        const calculatedAvgResolution = 
          mockInsights.reduce((sum, insight) => sum + insight.resolutionTime, 0) / mockInsights.length;
          
        const calculatedResolutionRate = 
          (mockInsights.filter(insight => insight.resolved).length / mockInsights.length) * 100;
        
        // Set state with mock data
        setCategoryData(mockCategoryData);
        setTopicData(mockTopicData);
        setDailyData(mockDailyData);
        setSentimentData(mockSentimentData);
        setInsights(mockInsights);
        setFilteredInsights(mockInsights);
        setTotalConversations(mockInsights.length);
        setAvgResponseTime(calculatedAvgResponse);
        setAvgResolutionTime(calculatedAvgResolution);
        setResolutionRate(calculatedResolutionRate);
        
        // Finished loading
        setIsLoading(false);
      }, 1000);
    };
    
    fetchData();
  }, [timeRange]);
  
  // Apply filters when changed
  useEffect(() => {
    let filtered = insights;
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(insight => insight.category === categoryFilter);
    }
    
    // Apply sentiment filter
    if (sentimentFilter !== 'all') {
      filtered = filtered.filter(insight => insight.sentiment === sentimentFilter);
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(insight => 
        insight.customerName.toLowerCase().includes(query) ||
        insight.topics.some(topic => topic.toLowerCase().includes(query)) ||
        insight.category.toLowerCase().includes(query)
      );
    }
    
    setFilteredInsights(filtered);
  }, [categoryFilter, sentimentFilter, searchQuery, insights]);
  
  // Generate report
  const handleGenerateReport = () => {
    setIsGeneratingReport(true);
    
    // Simulate report generation
    setTimeout(() => {
      setIsGeneratingReport(false);
      
      // In a real app, you would generate and download a CSV/PDF
      alert('Report generated! In a real implementation, this would download a CSV or PDF file.');
    }, 2000);
  };
  
  // Get sentiment badge color
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  
  return (
    <div className="container mx-auto py-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="brand-header flex items-center">
            <div className="mr-3 w-12 h-12 bg-black rounded-lg flex items-center justify-center">
              <img src="../assets/clean-machine-logo.svg" alt="Clean Machine Logo" className="w-full h-full" />
            </div>
            Conversation Insights
          </h1>
          <p className="text-gray-500">Analytics and trends from customer conversations</p>
        </div>
        
        <div className="flex gap-2">
          <Select 
            value={timeRange} 
            onValueChange={setTimeRange}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={() => setLocation('/dashboard')}>
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          
          <Button 
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
          >
            <Download className="mr-2 h-4 w-4" />
            {isGeneratingReport ? 'Generating' + typingFrames[typingFrame] : 'Export Report'}
          </Button>
        </div>
      </header>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(totalConversations)}</div>
            <p className="text-sm text-gray-500 mt-1">
              {timeRange === '24h' ? 'In the last 24 hours' : 
               timeRange === '7d' ? 'In the last 7 days' : 
               timeRange === '30d' ? 'In the last 30 days' : 'In the last 90 days'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Avg. AI Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgResponseTime.toFixed(1)}s</div>
            <p className="text-sm text-gray-500 mt-1">
              Time to first response
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Avg. Resolution Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgResolutionTime.toFixed(1)}m</div>
            <p className="text-sm text-gray-500 mt-1">
              From first message to resolution
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Resolution Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{resolutionRate.toFixed(1)}%</div>
            <p className="text-sm text-gray-500 mt-1">
              Conversations resolved without human
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-1 sm:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="trends">Trends & Patterns</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment Analysis</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <PieChart className="mr-2 h-5 w-5" />
                  Conversation Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <p>Loading{typingFrames[typingFrame]}</p>
                  </div>
                ) : (
                  <>
                    <div className="h-[300px] flex items-center justify-center">
                      {/* This would be a real chart in production */}
                      <div className="w-full max-w-xs">
                        <div className="flex flex-col space-y-2">
                          {categoryData.map((category) => (
                            <div key={category.category} className="flex items-center">
                              <div 
                                className="w-4 h-4 rounded-full mr-2" 
                                style={{ backgroundColor: category.color }}
                              ></div>
                              <div className="flex-1 text-sm">{category.category}</div>
                              <div className="font-medium">{category.count}</div>
                              <div className="text-gray-500 text-sm ml-2">
                                ({Math.round(category.count / categoryData.reduce((sum, cat) => sum + cat.count, 0) * 100)}%)
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Daily Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Daily Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <p>Loading{typingFrames[typingFrame]}</p>
                  </div>
                ) : (
                  <div className="h-[300px] overflow-x-auto">
                    {/* This would be a real chart in production */}
                    <div className="min-w-[500px] h-full flex flex-col justify-end">
                      <div className="flex h-[250px] items-end space-x-2">
                        {dailyData.map((day, index) => (
                          <div key={index} className="flex-1 flex flex-col items-center">
                            <div className="w-full flex justify-center items-end h-[200px] space-x-1">
                              <div 
                                className="w-3 bg-blue-500 rounded-t"
                                style={{ height: `${(day.conversations / 15) * 100}%` }}
                                title={`${day.conversations} conversations`}
                              ></div>
                              <div 
                                className="w-3 bg-green-500 rounded-t"
                                style={{ height: `${(day.messages / 100) * 100}%` }}
                                title={`${day.messages} messages`}
                              ></div>
                              <div 
                                className="w-3 bg-purple-500 rounded-t"
                                style={{ height: `${(day.newCustomers / 10) * 100}%` }}
                                title={`${day.newCustomers} new customers`}
                              ></div>
                            </div>
                            <div className="text-xs mt-2 font-medium">{day.date}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-center space-x-4 mt-4">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-blue-500 rounded mr-1"></div>
                          <span className="text-xs">Conversations</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
                          <span className="text-xs">Messages</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-purple-500 rounded mr-1"></div>
                          <span className="text-xs">New Customers</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Popular Topics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Popular Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <p>Loading{typingFrames[typingFrame]}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topicData.slice(0, 6).map((topic, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{topic.topic}</span>
                          <span className="text-sm text-gray-500">{topic.count} mentions</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ 
                              width: `${(topic.count / topicData[0].count) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Sentiment Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <ThumbsUp className="mr-2 h-5 w-5" />
                  Sentiment Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <p>Loading{typingFrames[typingFrame]}</p>
                  </div>
                ) : (
                  <div className="h-[300px] flex flex-col items-center justify-center">
                    <div className="w-full max-w-xs">
                      <div className="flex flex-col space-y-6">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center">
                              <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                              <span className="text-sm font-medium">Positive</span>
                            </div>
                            <span className="text-sm">{sentimentData.positive}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-4">
                            <div 
                              className="bg-green-500 h-4 rounded-full" 
                              style={{ width: `${sentimentData.positive}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center">
                              <div className="w-4 h-4 rounded-full bg-gray-400 mr-2"></div>
                              <span className="text-sm font-medium">Neutral</span>
                            </div>
                            <span className="text-sm">{sentimentData.neutral}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-4">
                            <div 
                              className="bg-gray-400 h-4 rounded-full" 
                              style={{ width: `${sentimentData.neutral}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center">
                              <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
                              <span className="text-sm font-medium">Negative</span>
                            </div>
                            <span className="text-sm">{sentimentData.negative}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-4">
                            <div 
                              className="bg-red-500 h-4 rounded-full" 
                              style={{ width: `${sentimentData.negative}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Conversations Tab */}
        <TabsContent value="conversations" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="w-full flex-1 relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input 
                    type="search" 
                    placeholder="Search by customer, topic, or category" 
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex w-full sm:w-auto gap-2">
                  <Select 
                    value={categoryFilter} 
                    onValueChange={setCategoryFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Booking">Booking</SelectItem>
                      <SelectItem value="Inquiry">Inquiry</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                      <SelectItem value="Feedback">Feedback</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={sentimentFilter} 
                    onValueChange={setSentimentFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Sentiment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sentiments</SelectItem>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button variant="outline" className="flex-shrink-0">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Conversation List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <BarChart2 className="mr-2 h-5 w-5" />
                Conversation Insights
                <Badge className="ml-2">{filteredInsights.length} results</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <p>Loading{typingFrames[typingFrame]}</p>
                </div>
              ) : filteredInsights.length === 0 ? (
                <div className="text-center py-16">
                  <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <h3 className="text-lg font-medium text-gray-700 mb-1">No conversations found</h3>
                  <p className="text-gray-500">Try adjusting your filters or search criteria</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <div className="grid grid-cols-8 gap-4 p-4 bg-gray-50 border-b text-sm font-medium text-gray-500">
                    <div className="col-span-2">Customer</div>
                    <div className="col-span-1">Date</div>
                    <div className="col-span-1">Category</div>
                    <div className="col-span-1">Duration</div>
                    <div className="col-span-1">Resolution</div>
                    <div className="col-span-1">Sentiment</div>
                    <div className="col-span-1">Actions</div>
                  </div>
                  
                  <div className="divide-y">
                    {filteredInsights.slice(0, 10).map((insight) => (
                      <div key={insight.id} className="grid grid-cols-8 gap-4 p-4 items-center hover:bg-gray-50">
                        <div className="col-span-2">
                          <div className="font-medium">{insight.customerName}</div>
                          <div className="text-xs text-gray-500">{insight.messageCount} messages</div>
                        </div>
                        <div className="col-span-1 text-sm">{insight.date}</div>
                        <div className="col-span-1">
                          <Badge variant="outline">{insight.category}</Badge>
                        </div>
                        <div className="col-span-1 text-sm">
                          {insight.duration}m
                        </div>
                        <div className="col-span-1">
                          {insight.resolved ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                              Unresolved
                            </Badge>
                          )}
                        </div>
                        <div className="col-span-1">
                          <Badge variant="outline" className={getSentimentColor(insight.sentiment)}>
                            {insight.sentiment.charAt(0).toUpperCase() + insight.sentiment.slice(1)}
                          </Badge>
                        </div>
                        <div className="col-span-1">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {filteredInsights.length > 10 && (
                    <div className="p-4 text-center">
                      <Button variant="outline">
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Trends & Patterns Tab */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Weekly Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <p>Loading{typingFrames[typingFrame]}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-2">Busiest Days</h4>
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                          // Generate random heights for the demonstration
                          const height = 20 + Math.floor(Math.random() * 80);
                          return (
                            <div key={i} className="flex flex-col items-center">
                              <div 
                                className={`w-full bg-blue-${height > 70 ? '600' : height > 40 ? '400' : '200'} rounded-t`}
                                style={{ height: `${height}px` }}
                              ></div>
                              <div className="text-xs font-medium mt-1">{day}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Busiest Hours</h4>
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: 24 }).map((_, i) => {
                          // Random activity level for demonstration
                          const activity = Math.random();
                          let bgColor;
                          
                          if (activity > 0.8) bgColor = 'bg-blue-600';
                          else if (activity > 0.6) bgColor = 'bg-blue-500';
                          else if (activity > 0.4) bgColor = 'bg-blue-400';
                          else if (activity > 0.2) bgColor = 'bg-blue-300';
                          else bgColor = 'bg-blue-200';
                          
                          return (
                            <div 
                              key={i}
                              className={`w-7 h-7 ${bgColor} rounded flex items-center justify-center text-white text-xs font-medium`}
                              title={`${i}:00 - ${i}:59`}
                            >
                              {i}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Topic Trends</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            <span className="text-sm">Pricing Inquiries</span>
                          </div>
                          <span className="text-sm text-green-600">+12.5%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                            <span className="text-sm">Booking Requests</span>
                          </div>
                          <span className="text-sm text-green-600">+8.2%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                            <span className="text-sm">Cancellations</span>
                          </div>
                          <span className="text-sm text-red-600">-3.1%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                            <span className="text-sm">Service Questions</span>
                          </div>
                          <span className="text-sm text-green-600">+5.7%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Customer Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Customer Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <p>Loading{typingFrames[typingFrame]}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-2">New vs. Returning Customers</h4>
                      <div className="w-full bg-gray-100 rounded-full h-4">
                        <div 
                          className="bg-blue-500 h-4 rounded-full" 
                          style={{ width: '65%' }}
                        >
                          <div className="flex justify-between px-2 text-xs text-white items-center h-full">
                            <span>New (65%)</span>
                            <span>Returning (35%)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Average Conversation Length</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>New Customers</span>
                          <span className="font-medium">8.4 messages</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Returning Customers</span>
                          <span className="font-medium">5.7 messages</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Response Satisfaction</h4>
                      <div className="space-y-1">
                        {[5, 4, 3, 2, 1].map((rating) => {
                          // Random widths for demonstration
                          const width = rating === 5 ? 70 : 
                                      rating === 4 ? 20 : 
                                      rating === 3 ? 7 : 
                                      rating === 2 ? 2 : 1;
                          
                          return (
                            <div key={rating} className="flex items-center gap-2">
                              <div className="text-sm font-medium w-6">{rating}</div>
                              <div className="flex-1 bg-gray-100 rounded-full h-2">
                                <div 
                                  className={`bg-${rating >= 4 ? 'green' : rating === 3 ? 'yellow' : 'red'}-500 h-2 rounded-full`}
                                  style={{ width: `${width}%` }}
                                ></div>
                              </div>
                              <div className="text-xs text-gray-500 w-8">{width}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Service Interest</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Full Detail</span>
                          <span className="text-sm font-medium">42%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Interior Only</span>
                          <span className="text-sm font-medium">28%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Ceramic Coating</span>
                          <span className="text-sm font-medium">15%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Exterior Only</span>
                          <span className="text-sm font-medium">10%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Other Services</span>
                          <span className="text-sm font-medium">5%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Sentiment Analysis Tab */}
        <TabsContent value="sentiment" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sentiment Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Sentiment Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <p>Loading{typingFrames[typingFrame]}</p>
                  </div>
                ) : (
                  <div className="h-[300px] relative">
                    {/* This would be a real chart in production */}
                    <div className="absolute inset-0 flex items-end">
                      <div className="w-full h-full flex items-end">
                        {Array.from({ length: 14 }).map((_, i) => {
                          // Generate random heights for positive, neutral, negative
                          const positive = 30 + Math.floor(Math.random() * 40);
                          const neutral = 10 + Math.floor(Math.random() * 30);
                          const negative = 5 + Math.floor(Math.random() * 15);
                          const total = positive + neutral + negative;
                          
                          const posHeight = (positive / total) * 100;
                          const neutralHeight = (neutral / total) * 100;
                          const negHeight = (negative / total) * 100;
                          
                          return (
                            <div key={i} className="flex-1 flex flex-col h-full justify-end items-center">
                              <div 
                                className="w-5 bg-red-500 rounded-t" 
                                style={{ height: `${negHeight}%` }}
                              ></div>
                              <div 
                                className="w-5 bg-gray-400" 
                                style={{ height: `${neutralHeight}%` }}
                              ></div>
                              <div 
                                className="w-5 bg-green-500" 
                                style={{ height: `${posHeight}%` }}
                              ></div>
                              <div className="text-xs mt-2">
                                {i % 2 === 0 ? new Date(Date.now() - i * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="absolute top-4 right-4 flex items-center space-x-4">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
                        <span className="text-xs">Positive</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-gray-400 rounded mr-1"></div>
                        <span className="text-xs">Neutral</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
                        <span className="text-xs">Negative</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Sentiment by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <PieChart className="mr-2 h-5 w-5" />
                  Sentiment by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <p>Loading{typingFrames[typingFrame]}</p>
                  </div>
                ) : (
                  <div className="h-[300px] overflow-y-auto">
                    {categoryData.map((category) => {
                      // Random sentiment distribution for demonstration
                      const positive = Math.floor(Math.random() * 50) + 50; // 50-100%
                      const negative = Math.floor(Math.random() * (100 - positive)); // 0-(100-positive)%
                      const neutral = 100 - positive - negative;
                      
                      return (
                        <div key={category.category} className="mb-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{category.category}</span>
                            <div className="flex items-center space-x-2 text-xs">
                              <span className="text-green-600">{positive}%</span>
                              <span className="text-gray-500">{neutral}%</span>
                              <span className="text-red-600">{negative}%</span>
                            </div>
                          </div>
                          <div className="w-full h-4 rounded-full overflow-hidden flex">
                            <div 
                              className="bg-green-500 h-full" 
                              style={{ width: `${positive}%` }}
                            ></div>
                            <div 
                              className="bg-gray-400 h-full" 
                              style={{ width: `${neutral}%` }}
                            ></div>
                            <div 
                              className="bg-red-500 h-full" 
                              style={{ width: `${negative}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <MessageSquare className="mr-2 h-5 w-5" />
                Sentiment Analysis Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p>Loading{typingFrames[typingFrame]}</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h4 className="font-medium mb-4">Common Positive Phrases</h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "great service", 
                        "very helpful", 
                        "excellent work", 
                        "thank you", 
                        "quick response",
                        "appreciate your help",
                        "perfect",
                        "fantastic results"
                      ].map((phrase, i) => (
                        <Badge
                          key={i}
                          variant="outline" 
                          className="bg-green-50 text-green-700 hover:bg-green-100"
                        >
                          {phrase}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-4">Common Negative Phrases</h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "too expensive", 
                        "took too long", 
                        "didn't understand", 
                        "frustrated", 
                        "wrong information",
                        "not helpful",
                        "disappointed"
                      ].map((phrase, i) => (
                        <Badge
                          key={i}
                          variant="outline" 
                          className="bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          {phrase}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-4">Sentiment by Time of Day</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <Card className="bg-gray-50 border">
                        <CardContent className="p-4 text-center">
                          <h5 className="text-sm font-medium">Morning</h5>
                          <div className="text-2xl font-bold text-green-600 mt-2">85%</div>
                          <p className="text-xs text-gray-500 mt-1">Positive</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gray-50 border">
                        <CardContent className="p-4 text-center">
                          <h5 className="text-sm font-medium">Afternoon</h5>
                          <div className="text-2xl font-bold text-green-600 mt-2">72%</div>
                          <p className="text-xs text-gray-500 mt-1">Positive</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gray-50 border">
                        <CardContent className="p-4 text-center">
                          <h5 className="text-sm font-medium">Evening</h5>
                          <div className="text-2xl font-bold text-green-600 mt-2">68%</div>
                          <p className="text-xs text-gray-500 mt-1">Positive</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gray-50 border">
                        <CardContent className="p-4 text-center">
                          <h5 className="text-sm font-medium">Night</h5>
                          <div className="text-2xl font-bold text-green-600 mt-2">62%</div>
                          <p className="text-xs text-gray-500 mt-1">Positive</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}