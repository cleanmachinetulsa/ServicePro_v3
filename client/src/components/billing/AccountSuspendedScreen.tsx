/**
 * Account Suspended Screen (SP-6)
 * 
 * Full-screen lockout view when tenant account is suspended.
 * Allows access only to billing and support pages.
 */

import { Link } from 'wouter';
import { ShieldX, CreditCard, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AccountSuspendedScreen() {
  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900 dark:to-slate-900 flex items-center justify-center p-4"
      data-testid="screen-account-suspended"
    >
      <Card className="max-w-lg w-full shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-4 bg-red-100 dark:bg-red-900/30 rounded-full w-fit mb-4">
            <ShieldX className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl text-gray-900 dark:text-white">
            Account Temporarily Suspended
          </CardTitle>
          <CardDescription className="text-base mt-2">
            We couldn't process your recent payment. Your account is paused to protect you from new charges.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              <strong>Don't worry — your data is safe.</strong> All your customers, appointments, and business information are preserved. Once you update your payment method, your account will be restored immediately.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="flex-1" data-testid="button-update-payment">
              <Link href="/settings/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Update Payment Method
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1" data-testid="button-contact-support">
              <Link href="/support">
                <HelpCircle className="mr-2 h-4 w-4" />
                Contact Support
              </Link>
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Need help? Our support team is available to assist you with any billing questions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
