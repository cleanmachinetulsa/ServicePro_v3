import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  PlusCircle,
  Moon,
  Sun,
  PanelRight,
  PanelRightClose,
  ArrowLeft,
  Menu,
  UserCircle,
  User,
  Phone,
} from 'lucide-react';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import logoImage from '@/assets/clean-machine-shield.png';

interface HeaderActionsProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNewMessage: () => void;
  selectedConversation: number | null;
  onBackToList: () => void;
  showProfilePanel: boolean;
  onToggleProfilePanel: () => void;
  onShowMobileProfile: () => void;
}

export default function HeaderActions({
  darkMode,
  onToggleDarkMode,
  onNewMessage,
  selectedConversation,
  onBackToList,
  showProfilePanel,
  onToggleProfilePanel,
  onShowMobileProfile,
}: HeaderActionsProps) {
  const { toast } = useToast();
  const [operatorDialogOpen, setOperatorDialogOpen] = useState(false);
  const [operatorName, setOperatorName] = useState('');

  const { data: userData } = useQuery<{ success: boolean; user: { operatorName?: string | null } }>({
    queryKey: ['/api/users/me'],
  });

  useEffect(() => {
    if (userData?.user?.operatorName) {
      setOperatorName(userData.user.operatorName);
    }
  }, [userData]);

  const updateOperatorMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest('PUT', '/api/users/me/operator-name', { operatorName: name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      toast({
        title: 'Success',
        description: 'Operator name updated successfully',
      });
      setOperatorDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update operator name',
        variant: 'destructive',
      });
    },
  });

  const handleSaveOperatorName = () => {
    updateOperatorMutation.mutate(operatorName);
  };

  return (
    <div className="border-b bg-white dark:bg-gray-900 shadow-sm dark:border-gray-800">
      <div className="px-4 md:px-6 py-4 md:py-5 flex items-center justify-between">
        {/* Logo and Branding */}
        <div className="flex items-center gap-3 md:gap-4">
          {selectedConversation ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToList}
              className="md:hidden -ml-2"
              data-testid="button-back-mobile"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
          <img 
            src={logoImage} 
            alt="Clean Machine Logo" 
            className="h-[72px] w-[72px] md:h-20 md:w-20 object-contain"
          />
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              CLEAN MACHINE
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">Messages Hub</p>
          </div>
        </div>

        {/* Desktop buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onNewMessage}
            data-testid="button-compose"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            New Message
          </Button>
          {selectedConversation && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onToggleProfilePanel}
              data-testid="button-toggle-profile"
              title={showProfilePanel ? "Hide Profile Panel" : "Show Profile Panel"}
            >
              {showProfilePanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onToggleDarkMode}
            data-testid="button-dark-mode"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Dialog open={operatorDialogOpen} onOpenChange={setOperatorDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-operator-settings">
                <User className="h-4 w-4 mr-2" />
                Operator Name
              </Button>
            </DialogTrigger>
            <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
              <DialogHeader>
                <DialogTitle className="dark:text-white">Set Operator Name</DialogTitle>
                <DialogDescription className="dark:text-gray-400">
                  Configure your name to personalize message templates. This replaces "our team" in automated messages.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="operator-name" className="dark:text-white">
                    Your Name
                  </Label>
                  <Input
                    id="operator-name"
                    data-testid="input-operator-name"
                    placeholder="e.g., Sarah, Mike, Team Leader"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    className="dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    Leave empty to use "our team" in templates
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOperatorDialogOpen(false)}
                  data-testid="button-cancel-operator"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveOperatorName}
                  disabled={updateOperatorMutation.isPending}
                  data-testid="button-save-operator"
                >
                  {updateOperatorMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" asChild data-testid="button-dashboard">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild data-testid="button-settings">
            <Link href="/settings">
              <SettingsIcon className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>

        {/* Mobile: Menu + Profile button */}
        <div className="md:hidden flex items-center gap-2">
          {selectedConversation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowMobileProfile}
              data-testid="button-profile-mobile"
            >
              <UserCircle className="h-5 w-5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-menu-mobile">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 dark:bg-gray-800 dark:border-gray-700">
              <DropdownMenuItem onClick={onNewMessage} data-testid="menu-compose">
                <PlusCircle className="h-4 w-4 mr-2" />
                New Message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleDarkMode} data-testid="menu-dark-mode">
                {darkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOperatorDialogOpen(true)} data-testid="menu-operator-settings">
                <User className="h-4 w-4 mr-2" />
                Operator Name
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer" data-testid="menu-dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer" data-testid="menu-settings">
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
