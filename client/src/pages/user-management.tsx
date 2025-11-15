import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Edit, Trash2, Key, Shield, UserCheck, UserX } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppShell } from '@/components/AppShell';

interface User {
  id: number;
  username: string;
  email: string | null;
  role: string;
  fullName: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: number | null;
}

export default function UserManagement() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState<string>('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    role: 'employee',
  });

  // Fetch current user to check permissions
  const { data: currentUserData } = useQuery<{ success: boolean; user: User }>({
    queryKey: ['/api/users/me'],
  });

  // Fetch all users
  const { data: usersData, isLoading } = useQuery<{ success: boolean; users: User[] }>({
    queryKey: ['/api/users/all'],
  });

  const users = usersData?.users || [];
  const currentUser = currentUserData?.user;

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/users/create', data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/all'] });
      setTempPassword(data.temporaryPassword);
      setFormData({ username: '', email: '', fullName: '', role: 'employee' });
      toast({
        title: 'User Created',
        description: 'New user created successfully. Save the temporary password!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
      return apiRequest('PUT', `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/all'] });
      setShowEditDialog(false);
      setSelectedUser(null);
      toast({
        title: 'User Updated',
        description: 'User updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest('POST', `/api/users/${userId}/reset-password`, {});
    },
    onSuccess: (data) => {
      setTempPassword(data.temporaryPassword);
      toast({
        title: 'Password Reset',
        description: 'Password has been reset. Save the new temporary password!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to reset password',
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest('DELETE', `/api/users/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/all'] });
      toast({
        title: 'User Deleted',
        description: 'User deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    },
  });

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-600',
      manager: 'bg-blue-600',
      employee: 'bg-green-600',
    };
    return (
      <Badge className={`${colors[role] || 'bg-gray-600'} text-white`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const handleCreateUser = () => {
    if (!formData.username || !formData.role) {
      toast({
        title: 'Missing Fields',
        description: 'Username and role are required',
        variant: 'destructive',
      });
      return;
    }
    createUserMutation.mutate(formData);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      fullName: user.fullName || '',
      role: user.role,
    });
    setShowEditDialog(true);
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;
    updateUserMutation.mutate({
      id: selectedUser.id,
      data: {
        email: formData.email,
        fullName: formData.fullName,
        role: formData.role,
        isActive: selectedUser.isActive,
      },
    });
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setShowResetDialog(true);
  };

  const confirmResetPassword = () => {
    if (!selectedUser) return;
    resetPasswordMutation.mutate(selectedUser.id);
    setShowResetDialog(false);
  };

  const handleToggleActive = (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { isActive: !user.isActive },
    });
  };

  const handleDeleteUser = (user: User) => {
    if (confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  if (!currentUser || (currentUser.role !== 'manager' && currentUser.role !== 'owner')) {
    return (
      <AppShell title="User Management">
        <div className="p-6 max-w-4xl mx-auto">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to access user management. This area is restricted to managers and owners.
            </AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const pageActions = (
    <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-user">
      <Plus className="h-4 w-4 mr-2" />
      Add User
    </Button>
  );

  return (
    <AppShell title="User Management" pageActions={pageActions}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <p className="text-muted-foreground">
          Manage employee, manager, and system access
        </p>

      {tempPassword && (
        <Alert className="mb-6 bg-yellow-50 border-yellow-300">
          <Key className="h-4 w-4" />
          <AlertDescription>
            <strong>Temporary Password:</strong> <code className="bg-yellow-100 px-2 py-1 rounded">{tempPassword}</code>
            <br />
            <span className="text-sm">Save this password securely. It won't be shown again. The user will be required to change it on first login.</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-4"
              onClick={() => setTempPassword('')}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
          <CardDescription>
            View and manage all system users and their access levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{user.fullName || user.username}</h3>
                      {getRoleBadge(user.role)}
                      {!user.isActive && (
                        <Badge variant="outline" className="border-red-300 text-red-600">
                          Inactive
                        </Badge>
                      )}
                      {user.id === currentUser.id && (
                        <Badge variant="outline">You</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Username: {user.username} {user.email && `• Email: ${user.email}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Created: {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {user.id !== currentUser.id && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(user)}
                          data-testid={`button-toggle-${user.id}`}
                        >
                          {user.isActive ? (
                            <><UserX className="h-4 w-4 mr-1" /> Deactivate</>
                          ) : (
                            <><UserCheck className="h-4 w-4 mr-1" /> Activate</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetPassword(user)}
                          data-testid={`button-reset-${user.id}`}
                        >
                          <Key className="h-4 w-4 mr-1" />
                          Reset Password
                        </Button>
                        {currentUser.role === 'owner' && user.role !== 'owner' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new employee or manager account. They'll receive a temporary password and must change it on first login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g., john.doe"
                data-testid="input-username"
              />
            </div>

            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g., John Doe"
                data-testid="input-fullname"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g., john@example.com"
                data-testid="input-email"
              />
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  {currentUser.role === 'owner' && (
                    <SelectItem value="manager">Manager</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                {formData.role === 'employee' && 'Basic access to appointments and customer data'}
                {formData.role === 'manager' && 'Can manage employees and access advanced features'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
              data-testid="button-create-user"
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and access level
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input value={formData.username} disabled />
            </div>

            <div>
              <Label htmlFor="edit-fullName">Full Name</Label>
              <Input
                id="edit-fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                data-testid="input-edit-fullname"
              />
            </div>

            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-edit-email"
              />
            </div>

            {currentUser.role === 'owner' && (
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
              data-testid="button-update-user"
            >
              {updateUserMutation.isPending ? 'Updating...' : 'Update User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Generate a new temporary password for {selectedUser?.username}. They'll be required to change it on next login.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmResetPassword}
              disabled={resetPasswordMutation.isPending}
              data-testid="button-confirm-reset"
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AppShell>
  );
}
