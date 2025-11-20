import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Phone, Server, Smartphone, CheckCircle, AlertCircle, Settings, Key, Network, Bell } from 'lucide-react';
import CommunicationsNav from '@/components/CommunicationsNav';

export default function SipSetupGuide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <CommunicationsNav />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            SIP Setup Guide
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure Twilio SIP routing to enable custom ringtones for business calls on your Samsung phone
          </p>
        </div>

        {/* Overview Card */}
        <Card className="mb-6 border-purple-200 dark:border-purple-800">
          <CardHeader className="bg-purple-50 dark:bg-purple-900/20">
            <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
              <Phone className="h-5 w-5" />
              What is SIP Routing?
            </CardTitle>
            <CardDescription>
              Understand how SIP routing enables custom ringtones for business calls
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              SIP (Session Initiation Protocol) routing allows your business calls to ring on your Samsung phone 
              through a SIP endpoint instead of a regular phone number. This enables you to:
            </p>
            <ul className="space-y-2 ml-6">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  Set a custom ringtone specifically for business calls (e.g., "Clean Machine" ringtone)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  Display a custom line label (e.g., "Clean Machine SIP Line") when calls come in
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  Still see the real customer's caller ID (not your business number)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  Instantly recognize business calls by sound and visual cues
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Step 1: Create Twilio SIP Domain */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-purple-600 dark:bg-purple-500 text-white">Step 1</Badge>
              <Server className="h-5 w-5" />
              Create Twilio SIP Domain
            </CardTitle>
            <CardDescription>
              Set up a SIP domain in your Twilio account to route calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-4 list-decimal list-inside">
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Log into Twilio Console:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Go to <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 underline">console.twilio.com</a>
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Navigate to Voice → SIP Domains:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  From the left sidebar: Explore Products → Voice → Manage → SIP Domains
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Click "Create new SIP Domain":</strong>
                <div className="ml-6 mt-2 space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Domain Name:</strong> Choose a unique name (e.g., <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">cleanmachinetulsa</code>)
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This creates a full SIP URI like: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">cleanmachinetulsa.sip.twilio.com</code>
                  </p>
                </div>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Configure Voice Settings:</strong>
                <div className="ml-6 mt-2 space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Request URL:</strong> Leave this blank (your app handles routing automatically)
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>SIP Registration:</strong> Set to "Enabled" to allow devices to register
                  </p>
                </div>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Save your SIP Domain</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Your domain will be created and ready to use
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Step 2: Create SIP Credentials */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-purple-600 dark:bg-purple-500 text-white">Step 2</Badge>
              <Key className="h-5 w-5" />
              Create SIP Credentials
            </CardTitle>
            <CardDescription>
              Set up authentication credentials for your SIP endpoint
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-4 list-decimal list-inside">
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Go to SIP Credential Lists:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  From Voice → SIP Domains → Your Domain → Credential Lists
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Create new Credential List:</strong>
                <div className="ml-6 mt-2 space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Click "Create a new Credential List"
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Friendly Name:</strong> <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">Clean Machine Credentials</code>
                  </p>
                </div>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Add Credential:</strong>
                <div className="ml-6 mt-2 space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Username:</strong> Your SIP username (e.g., <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">jody</code>)
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Password:</strong> Create a strong password (store this securely!)
                  </p>
                </div>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Copy the Credential SID:</strong>
                <div className="ml-6 mt-2 space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    After creating the credential list, copy its SID (starts with <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">CL...</code>)
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You'll need this for the Phone Settings SIP configuration
                  </p>
                </div>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Map Credential List to your SIP Domain:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  In your SIP Domain settings, add this credential list under "Credential Lists"
                </p>
              </li>
            </ol>

            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded mt-4">
              <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Important:</strong> Store your SIP password securely. You'll need it to configure your Samsung phone, 
                but it should NEVER be entered into the Clean Machine app (we only store the Credential SID).
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Configure Samsung Phone */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-purple-600 dark:bg-purple-500 text-white">Step 3</Badge>
              <Smartphone className="h-5 w-5" />
              Configure Samsung Phone SIP Account
            </CardTitle>
            <CardDescription>
              Add the SIP account to your Samsung device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-4 list-decimal list-inside">
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Open Phone App Settings:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Open the Phone app → Menu (three dots) → Settings → Calling accounts → SIP accounts
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Add New SIP Account:</strong>
                <div className="ml-6 mt-2 space-y-3 bg-gray-50 dark:bg-gray-800 p-4 rounded">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Profile Name:</p>
                    <code className="text-sm bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">Clean Machine SIP Line</code>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Username:</p>
                    <code className="text-sm bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">jody</code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(same as Twilio credential)</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Password:</p>
                    <code className="text-sm bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">••••••••</code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(password from Twilio credential)</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Server:</p>
                    <code className="text-sm bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">cleanmachinetulsa.sip.twilio.com</code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(your Twilio SIP Domain)</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Optional Settings:</p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                      <li>• Authentication username: <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">jody</code></li>
                      <li>• Outbound proxy: (leave blank)</li>
                      <li>• Port: <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">5060</code> (default)</li>
                      <li>• Transport: <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">UDP</code> (default)</li>
                    </ul>
                  </div>
                </div>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Save the SIP Account</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Your phone will attempt to register with the Twilio SIP domain
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Verify Registration:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  The account should show as "Registered" or "Active". If not, check your credentials and server address.
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Step 4: Configure Custom Ringtone */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-purple-600 dark:bg-purple-500 text-white">Step 4</Badge>
              <Bell className="h-5 w-5" />
              Assign Custom Ringtone
            </CardTitle>
            <CardDescription>
              Set a unique ringtone for your SIP business line
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-4 list-decimal list-inside">
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Access SIP Account Settings:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Phone app → Settings → Calling accounts → SIP accounts → Tap your "Clean Machine SIP Line" account
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Set Ringtone:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Look for "Ringtone" or "Incoming call" settings
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Choose Custom Ringtone:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Select a distinctive ringtone that you'll recognize as your business line (e.g., upload a custom "Clean Machine" sound)
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Test the Ringtone:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Have someone call your business number and verify the custom ringtone plays
                </p>
              </li>
            </ol>

            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded mt-4">
              <CheckCircle className="h-5 w-5 text-green-700 dark:text-green-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-700 dark:text-green-300">
                <strong>Success!</strong> When a customer calls your business number, you'll now hear your custom ringtone 
                and see "Clean Machine SIP Line" on your phone, while still seeing the customer's real caller ID.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 5: Enable in Phone Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-purple-600 dark:bg-purple-500 text-white">Step 5</Badge>
              <Settings className="h-5 w-5" />
              Enable SIP Routing in Clean Machine
            </CardTitle>
            <CardDescription>
              Configure your phone line to use SIP routing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-4 list-decimal list-inside">
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Go to Phone Settings:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Navigate to Communications → Phone Settings in your Clean Machine dashboard
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Edit Phone Line Configuration:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Click "Configure" on your business phone line
                </p>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Enable SIP Routing:</strong>
                <div className="ml-6 mt-2 space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Toggle on "Enable SIP Routing"
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded space-y-2">
                    <p className="text-sm">
                      <strong>SIP Endpoint:</strong> <code className="bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded text-xs">jody@cleanmachinetulsa.sip.twilio.com</code>
                    </p>
                    <p className="text-sm">
                      <strong>Credential SID:</strong> <code className="bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded text-xs">CLxxx...</code> (from Step 2)
                    </p>
                    <p className="text-sm">
                      <strong>Fallback Number:</strong> <code className="bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded text-xs">+19188565711</code> (optional)
                    </p>
                  </div>
                </div>
              </li>
              
              <li className="text-gray-700 dark:text-gray-300">
                <strong>Save Changes:</strong>
                <p className="ml-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  All incoming calls will now route through SIP
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card className="mb-6 border-amber-200 dark:border-amber-800">
          <CardHeader className="bg-amber-50 dark:bg-amber-900/20">
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <AlertCircle className="h-5 w-5" />
              Troubleshooting
            </CardTitle>
            <CardDescription>
              Common issues and solutions
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Phone shows "Not Registered" or "Registration Failed"
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-6">
                  <li>• Verify your SIP username and password match exactly</li>
                  <li>• Check that the server address is correct (e.g., <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">yourdomain.sip.twilio.com</code>)</li>
                  <li>• Ensure your phone has internet connectivity (WiFi or mobile data)</li>
                  <li>• Try toggling airplane mode on/off to refresh network connections</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Calls don't ring on my phone
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-6">
                  <li>• Verify SIP account is registered (shows "Active" or "Registered")</li>
                  <li>• Check that "Enable SIP Routing" is toggled ON in Phone Settings</li>
                  <li>• Confirm the SIP endpoint format is correct (username@domain)</li>
                  <li>• Test with a fallback number to verify if SIP-specific or general routing issue</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Custom ringtone doesn't play
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-6">
                  <li>• Verify the ringtone is assigned specifically to the SIP account (not general phone ringtone)</li>
                  <li>• Check that phone volume is turned up and not in Do Not Disturb mode</li>
                  <li>• Some Samsung models require the SIP account to be set as "Use for all calls"</li>
                  <li>• Try re-assigning the ringtone after a successful call test</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Caller ID not showing correctly
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-6">
                  <li>• This is a Twilio SIP limitation - caller ID passthrough may not work on all carriers</li>
                  <li>• You may see your business number instead of the customer's number</li>
                  <li>• Check voicemail transcriptions or call logs for customer information</li>
                  <li>• Consider using the fallback number if caller ID is critical</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Need to switch back to regular forwarding
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-6">
                  <li>• Simply toggle OFF "Enable SIP Routing" in Phone Settings</li>
                  <li>• Calls will immediately switch back to standard PSTN forwarding</li>
                  <li>• Your SIP configuration is saved and can be re-enabled anytime</li>
                  <li>• No need to remove the SIP account from your Samsung phone</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Additional Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://www.twilio.com/docs/voice/sip" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Twilio SIP Documentation
                </a>
              </li>
              <li>
                <a 
                  href="https://www.twilio.com/docs/voice/sip/receiving-sip-calls" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Receiving SIP Calls - Twilio Guide
                </a>
              </li>
              <li>
                <a 
                  href="https://www.samsung.com/us/support/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Samsung Phone Support
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
