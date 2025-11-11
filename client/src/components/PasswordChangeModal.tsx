import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Key, AlertCircle } from 'lucide-react';

export default function PasswordChangeModal() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  // Public pages that don't require authentication
  const publicPages = [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/change-password',
    '/approve/',
    '/quote-approval/',
    '/sms-consent',
    '/privacy-policy',
    '/maintenance',
    '/showcase',
    '/chat',
    '/directions',
    '/service-history',
    '/demo',
    '/',
    '/schedule',
    '/quick-booking',
    '/rewards',
    '/gallery',
    '/reviews',
    '/recurring-service-booking',
    '/tech-profile-public',
  ];

  const isPublicPage = publicPages.some(page => location.startsWith(page)) || location === '/';

  // Check if user needs to change password (only on protected pages)
  const { data: userData } = useQuery({
    queryKey: ['/api/users/me'],
    refetchInterval: 5000, // Check every 5 seconds
    enabled: !isPublicPage, // Only fetch on protected pages
  });

  const user = userData?.user;

  useEffect(() => {
    if (user?.requirePasswordChange) {
      setShowDialog(true);
    } else {
      setShowDialog(false);
    }
  }, [user?.requirePasswordChange]);

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { newPassword: string }) => {
      return apiRequest('POST', '/api/auth/change-password', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: 'Password Changed',
        description: 'Your password has been changed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Change Failed',
        description: error.message || 'Failed to change password',
        variant: 'destructive',
      });
    },
  });

  const handleChangePassword = () => {
    if (!newPassword) {
      toast({
        title: 'Missing Password',
        description: 'Please enter a new password',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Weak Password',
        description: 'Password must be at least 8 characters long',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords Do Not Match',
        description: 'Please make sure both passwords match',
        variant: 'destructive',
      });
      return;
    }

    changePasswordMutation.mutate({ newPassword });
  };

  if (!user?.requirePasswordChange) {
    return null;
  }

  return (
    <Dialog open={showDialog} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password Required
          </DialogTitle>
          <DialogDescription>
            For security, you must change your temporary password before accessing the system.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your administrator has set a temporary password. Please create a new, secure password now.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              data-testid="input-new-password"
            />
          </div>

          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              data-testid="input-confirm-password"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending}
            data-testid="button-change-password"
          >
            {changePasswordMutation.isPending ? 'Changing Password...' : 'Change Password'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
