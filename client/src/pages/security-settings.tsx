import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, KeyRound, History, Download, AlertTriangle, Users } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppShell } from '@/components/AppShell';

interface TwoFactorStatus {
  enabled: boolean;
  setupComplete: boolean;
}

interface SecurityStats {
  totalLoginAttempts: number;
  failedLoginAttempts: number;
  successfulLogins: number;
  lockedAccounts: number;
  twoFactorEnabled: number;
  recentFailedAttempts: Array<{
    username: string;
    attemptedAt: string;
    ipAddress: string | null;
  }>;
}

interface AuditLog {
  id: number;
  userId: number;
  username: string;
  action: string;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  performedAt: string;
}

interface SetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [setupData, setSetupData] = useState<SetupResponse | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const { data: currentUserData } = useQuery<{ success: boolean; user: { role: string } }>({
    queryKey: ['/api/users/me'],
  });

  const { data: status, isLoading: statusLoading } = useQuery<TwoFactorStatus>({
    queryKey: ["/api/auth/2fa/status"],
  });

  const { data: stats } = useQuery<SecurityStats>({
    queryKey: ["/api/auth/2fa/security-stats"],
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/auth/2fa/audit-logs"],
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/auth/2fa/setup", "POST");
      return res;
    },
    onSuccess: (data: SetupResponse) => {
      setSetupData(data);
      setShowSetupDialog(true);
    },
    onError: () => {
      toast({
        title: "Setup failed",
        description: "Failed to initialize 2FA setup",
        variant: "destructive",
      });
    },
  });

  const enableMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest("/api/auth/2fa/enable", "POST", { verificationCode: code });
    },
    onSuccess: () => {
      toast({
        title: "2FA enabled",
        description: "Two-factor authentication is now active",
      });
      setShowSetupDialog(false);
      setShowBackupCodes(true);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/2fa/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/2fa/security-stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/auth/2fa/disable", "POST");
    },
    onSuccess: () => {
      toast({
        title: "2FA disabled",
        description: "Two-factor authentication has been turned off",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/2fa/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/2fa/security-stats"] });
    },
    onError: () => {
      toast({
        title: "Failed to disable",
        description: "Could not disable two-factor authentication",
        variant: "destructive",
      });
    },
  });

  const handleSetup = () => {
    setupMutation.mutate();
  };

  const handleVerify = () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter a 6-digit code",
        variant: "destructive",
      });
      return;
    }
    enableMutation.mutate(verificationCode);
  };

  const handleDisable = () => {
    if (confirm("Are you sure you want to disable two-factor authentication? This will make your account less secure.")) {
      disableMutation.mutate();
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData?.backupCodes) return;
    
    const content = `Clean Machine Auto Detail - 2FA Backup Codes\n\nGenerated: ${new Date().toLocaleString()}\n\nIMPORTANT: Store these codes in a safe place. Each code can only be used once.\n\n${setupData.backupCodes.join('\n')}\n\nIf you lose access to your authenticator app, you can use these codes to log in.`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Backup codes downloaded",
      description: "Store these codes in a safe place",
    });
  };

  if (statusLoading) {
    return (
      <AppShell title="Security Settings">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">Loading security settings...</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const canManageUsers = currentUserData?.user?.role === 'manager' || currentUserData?.user?.role === 'owner';

  return (
    <AppShell title="Security Settings">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <p className="text-slate-600 dark:text-slate-400 mb-6">Manage authentication and view security logs</p>

        {/* Admin Quick Link - User Management */}
        {canManageUsers && (
          <Card data-testid="card-user-management" className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage team access and roles for your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Create, edit, and manage user accounts, roles, and permissions for employees and managers.
                </p>
                <Button 
                  onClick={() => setLocation('/user-management')}
                  className="ml-4 bg-purple-600 hover:bg-purple-700"
                  data-testid="button-open-user-management"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="2fa" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="2fa" data-testid="tab-2fa">
              <KeyRound className="w-4 h-4 mr-2" />
              Two-Factor Auth
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              <History className="w-4 h-4 mr-2" />
              Activity Logs
            </TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Security Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="2fa" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Two-Factor Authentication
                  {status?.enabled ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-2fa-enabled">
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="outline" data-testid="badge-2fa-disabled">Disabled</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account by requiring a verification code from your authenticator app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!status?.enabled ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Why enable 2FA?</h3>
                      <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                        <li>• Protects against password theft</li>
                        <li>• Requires physical access to your phone</li>
                        <li>• Works with Google Authenticator, Authy, and other apps</li>
                        <li>• Includes backup codes for emergencies</li>
                      </ul>
                    </div>
                    <Button 
                      onClick={handleSetup} 
                      disabled={setupMutation.isPending}
                      className="w-full"
                      data-testid="button-setup-2fa"
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      {setupMutation.isPending ? "Setting up..." : "Set Up Two-Factor Authentication"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <p className="text-green-800 dark:text-green-200 text-sm">
                        ✓ Your account is protected with two-factor authentication
                      </p>
                    </div>
                    <Button 
                      onClick={handleDisable}
                      disabled={disableMutation.isPending}
                      variant="destructive"
                      className="w-full"
                      data-testid="button-disable-2fa"
                    >
                      {disableMutation.isPending ? "Disabling..." : "Disable Two-Factor Authentication"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Admin Activity</CardTitle>
                <CardDescription>View all administrative actions and changes</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs && auditLogs.length > 0 ? (
                  <div className="space-y-3">
                    {auditLogs.slice(0, 20).map((log) => (
                      <div key={log.id} className="border-b pb-3 last:border-0" data-testid={`audit-log-${log.id}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-slate-900 dark:text-white">{log.action}</span>
                          <span className="text-xs text-slate-500">{new Date(log.performedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">User: {log.username}</p>
                        {log.ipAddress && (
                          <p className="text-xs text-slate-500">IP: {log.ipAddress}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">No activity logs found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Login Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Total Login Attempts</span>
                    <span className="font-bold" data-testid="stat-total-attempts">{stats?.totalLoginAttempts || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Successful Logins</span>
                    <span className="font-bold text-green-600" data-testid="stat-successful">{stats?.successfulLogins || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Failed Attempts</span>
                    <span className="font-bold text-red-600" data-testid="stat-failed">{stats?.failedLoginAttempts || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">2FA Enabled Users</span>
                    <span className="font-bold" data-testid="stat-2fa-enabled">{stats?.twoFactorEnabled || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Locked Accounts</span>
                    <span className="font-bold text-orange-600" data-testid="stat-locked">{stats?.lockedAccounts || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {stats?.recentFailedAttempts && stats.recentFailedAttempts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Failed Login Attempts</CardTitle>
                  <CardDescription>Monitor suspicious login activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.recentFailedAttempts.slice(0, 10).map((attempt, idx) => (
                      <div key={idx} className="border-b pb-3 last:border-0" data-testid={`failed-attempt-${idx}`}>
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-slate-900 dark:text-white">{attempt.username}</span>
                          <span className="text-xs text-slate-500">{new Date(attempt.attemptedAt).toLocaleString()}</span>
                        </div>
                        {attempt.ipAddress && (
                          <p className="text-xs text-slate-500">IP: {attempt.ipAddress}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* 2FA Setup Dialog */}
        <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
          <DialogContent className="max-w-md" data-testid="dialog-2fa-setup">
            <DialogHeader>
              <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Scan the QR code with your authenticator app, then enter the 6-digit code to verify
              </DialogDescription>
            </DialogHeader>
            
            {setupData && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border-2 border-slate-200 flex justify-center">
                  <img 
                    src={setupData.qrCodeUrl} 
                    alt="2FA QR Code" 
                    className="w-48 h-48"
                    data-testid="img-qr-code"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!setupData.qrCodeUrl) return;
                    const link = document.createElement('a');
                    link.href = setupData.qrCodeUrl;
                    link.download = `2fa-qr-code-${Date.now()}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast({
                      title: "QR code downloaded",
                      description: "Save this for backup access",
                    });
                  }}
                  className="w-full"
                  data-testid="button-download-qr"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download QR Code
                </Button>

                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Manual Entry Code:</p>
                  <code className="text-sm font-mono break-all" data-testid="text-secret-code">{setupData.secret}</code>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verification-code">Enter 6-Digit Code</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    data-testid="input-verification-code"
                  />
                </div>

                <Button 
                  onClick={handleVerify}
                  disabled={enableMutation.isPending || verificationCode.length !== 6}
                  className="w-full"
                  data-testid="button-verify-2fa"
                >
                  {enableMutation.isPending ? "Verifying..." : "Verify and Enable"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Backup Codes Dialog */}
        <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
          <DialogContent className="max-w-md" data-testid="dialog-backup-codes">
            <DialogHeader>
              <DialogTitle>Backup Codes</DialogTitle>
              <DialogDescription>
                Save these codes in a safe place. Each can be used once if you lose access to your authenticator app.
              </DialogDescription>
            </DialogHeader>
            
            {setupData && (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-2" data-testid="backup-codes-list">
                    {setupData.backupCodes.map((code, idx) => (
                      <code key={idx} className="text-sm font-mono bg-white dark:bg-slate-900 p-2 rounded border">
                        {code}
                      </code>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={downloadBackupCodes}
                  variant="outline"
                  className="w-full"
                  data-testid="button-download-codes"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Backup Codes
                </Button>

                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    ⚠️ Store these codes securely. They won't be shown again!
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
