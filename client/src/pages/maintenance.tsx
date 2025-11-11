import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Wrench, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import logoUrl from "@assets/ab_Clean4-03.jpg";

export default function Maintenance() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [backupEmail, setBackupEmail] = useState("");
  const [alertPhone, setAlertPhone] = useState("");

  useEffect(() => {
    // Parse message from URL query parameters
    // Note: URLSearchParams.get() already returns decoded strings
    const params = new URLSearchParams(window.location.search);
    const msg = params.get('message');
    const email = params.get('email');
    const phone = params.get('phone');
    
    if (msg) {
      setMessage(msg);
    }
    if (email) {
      setBackupEmail(email);
    }
    if (phone) {
      setAlertPhone(phone);
    }
  }, []);

  const handleRetry = () => {
    // Reload the page to check if maintenance mode is still active
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center mb-4">
            <img 
              src={logoUrl} 
              alt="Clean Machine Logo" 
              className="h-20 w-20 object-contain"
            />
          </div>
          <div className="flex items-center justify-center gap-3 text-amber-600 dark:text-amber-400">
            <Wrench className="h-10 w-10" />
            <AlertCircle className="h-10 w-10" />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            System Maintenance
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 dark:text-gray-400">
            We're currently performing maintenance on our booking system
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Custom maintenance message */}
          {message && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-gray-800 dark:text-gray-200 text-center">
                {message}
              </p>
            </div>
          )}

          {/* Default message if no custom message */}
          {!message && (
            <div className="text-center space-y-2">
              <p className="text-gray-700 dark:text-gray-300">
                Our booking system is temporarily unavailable while we perform scheduled maintenance.
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                This should only take a few minutes. Thank you for your patience!
              </p>
            </div>
          )}

          {/* Backup contact methods */}
          {(backupEmail || alertPhone) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
              <p className="text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                Need immediate assistance?
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {backupEmail && (
                  <a
                    href={`mailto:${backupEmail}`}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    Email Us
                  </a>
                )}
                {alertPhone && (
                  <a
                    href={`tel:${alertPhone}`}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    Call Us
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Retry button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleRetry}
              variant="outline"
              className="w-full sm:w-auto"
              data-testid="button-retry"
            >
              Try Again
            </Button>
          </div>

          {/* Additional info */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-500 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p>If this issue persists, please contact us directly.</p>
            <p className="mt-1">We apologize for any inconvenience.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
