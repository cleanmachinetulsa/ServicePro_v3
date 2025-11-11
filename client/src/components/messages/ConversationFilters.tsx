import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, MessageCircle, Smartphone, Mail, Globe } from 'lucide-react';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

interface ConversationFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function ConversationFilters({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: ConversationFiltersProps) {
  return (
    <div className="p-4 space-y-3 border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20"
          data-testid="input-search-conversations"
        />
      </div>

      <Tabs value={activeFilter} onValueChange={onFilterChange}>
        <TabsList className="grid w-full grid-cols-6 bg-white dark:bg-gray-800 h-10">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger 
                  value="all" 
                  data-testid="filter-all" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-white px-2"
                >
                  <MessageCircle className="h-4 w-4" />
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>All Messages</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger 
                  value="sms" 
                  data-testid="filter-sms" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-white px-2"
                >
                  <Smartphone className="h-4 w-4" />
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>SMS / Text Message</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger 
                  value="web" 
                  data-testid="filter-web" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-white px-2"
                >
                  <Globe className="h-4 w-4" />
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Web Chat</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger 
                  value="facebook" 
                  data-testid="filter-facebook" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-white px-2"
                >
                  <FaFacebook className="h-4 w-4" />
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Facebook Messenger</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger 
                  value="instagram" 
                  data-testid="filter-instagram" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-white px-2"
                >
                  <FaInstagram className="h-4 w-4" />
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Instagram DM</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger 
                  value="email" 
                  data-testid="filter-email" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-white px-2"
                >
                  <Mail className="h-4 w-4" />
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Email</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TabsList>
      </Tabs>
    </div>
  );
}
