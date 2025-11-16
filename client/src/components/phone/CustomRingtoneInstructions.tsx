import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Smartphone, Info } from 'lucide-react';

export function CustomRingtoneInstructions() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>Set Custom Ringtone for Business Calls</CardTitle>
        </div>
        <CardDescription>
          Distinguish business calls from spam with a unique ringtone
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            When customers call, you'll see their actual phone number as Caller ID.
            This allows you to save their contact and set a custom ringtone.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              iPhone Instructions:
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>When a customer calls, save their number to Contacts</li>
              <li>Open Contacts app → find the customer</li>
              <li>Tap "Edit" → Scroll to "Ringtone"</li>
              <li>Select a unique ringtone (e.g., "Strum" or "Uplift")</li>
              <li>Repeat for all business contacts</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Android Instructions:
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>When a customer calls, save their number to Contacts</li>
              <li>Open Contacts app → find the customer</li>
              <li>Tap menu (⋮) → "Set ringtone"</li>
              <li>Choose a unique ringtone</li>
              <li>Repeat for all business contacts</li>
            </ol>
          </div>

          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong>Pro Tip:</strong> Set the same ringtone for all business contacts, or categorize by
              customer type (VIP customers = one ringtone, new customers = another)
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
