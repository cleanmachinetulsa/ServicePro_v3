import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Phone, Mail } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-3xl">Privacy Policy</CardTitle>
                <CardDescription>Clean Machine Auto Detail</CardDescription>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Last Updated: January 2025
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Information We Collect
              </h2>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-muted-foreground mb-2">We collect the following information when you use our services:</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• <strong>Contact Information:</strong> Name, phone number, email address</li>
                  <li>• <strong>Service Address:</strong> Location where services are performed</li>
                  <li>• <strong>Vehicle Information:</strong> Make, model, year, and service history</li>
                  <li>• <strong>Appointment Details:</strong> Scheduled service dates, times, and preferences</li>
                  <li>• <strong>Payment Information:</strong> Processed securely through our payment providers</li>
                  <li>• <strong>SMS Consent Records:</strong> Timestamp and IP address when you consent to SMS messaging</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">How We Use Your Information</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>We use your information exclusively to:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Schedule and manage your auto detailing appointments</li>
                  <li>• Send appointment confirmations, reminders, and service updates via SMS and email</li>
                  <li>• Provide customer service and respond to your inquiries</li>
                  <li>• Process payments for services rendered</li>
                  <li>• Maintain accurate service history records for your vehicles</li>
                  <li>• Improve our services based on customer feedback</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-green-700 dark:text-green-400">
                Third-Party Information Sharing
              </h2>
              <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm font-semibold mb-2">We DO NOT share your personal information with third parties for marketing or promotional purposes.</p>
                <p className="text-sm text-muted-foreground mb-2">
                  We may share your information only with trusted service providers who help us deliver our services to you, including:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• <strong>Payment Processors:</strong> Stripe and PayPal (to process payments securely)</li>
                  <li>• <strong>Communication Services:</strong> Twilio (for SMS notifications), SendGrid (for email delivery)</li>
                  <li>• <strong>Mapping Services:</strong> Google Maps (for address validation and routing)</li>
                  <li>• <strong>Cloud Storage:</strong> Google Drive (for customer photos and service documentation)</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  These service providers are contractually obligated to use your information only to fulfill the services we provide to you and may not use your data for their own purposes.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                SMS Text Messaging
              </h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>When you consent to receive SMS messages from Clean Machine Auto Detail:</p>
                <ul className="ml-4 space-y-1">
                  <li>• We will send appointment confirmations, reminders, ETAs, and service updates</li>
                  <li>• Message frequency varies based on your appointments and service needs</li>
                  <li>• Standard message and data rates may apply from your mobile carrier</li>
                  <li>• You can opt out at any time by replying <strong>STOP</strong> to any message</li>
                  <li>• You can get help by replying <strong>HELP</strong> to any message</li>
                  <li>• We record your consent timestamp and IP address for compliance purposes</li>
                </ul>
                <p className="mt-2">
                  We will never send unsolicited marketing messages to numbers that have only consented to transactional appointment communications.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Data Security</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  We implement industry-standard security measures to protect your personal information from unauthorized access, 
                  disclosure, alteration, or destruction. This includes:
                </p>
                <ul className="ml-4 space-y-1">
                  <li>• Encrypted data transmission using SSL/TLS protocols</li>
                  <li>• Secure storage of customer records in protected databases</li>
                  <li>• Access controls limiting who can view your information</li>
                  <li>• Regular security audits and updates</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Your Privacy Rights</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>You have the right to:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Access the personal information we have about you</li>
                  <li>• Request corrections to inaccurate information</li>
                  <li>• Request deletion of your personal information (subject to legal retention requirements)</li>
                  <li>• Opt out of SMS messaging at any time by replying STOP</li>
                  <li>• Opt out of email communications by clicking unsubscribe in any email</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Data Retention</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  We retain your personal information for as long as necessary to provide our services and comply with legal obligations. 
                  Service history and appointment records are maintained to provide continuity of care for your vehicles.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Children's Privacy</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information 
                  from children.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Changes to This Policy</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new 
                  Privacy Policy on this page and updating the "Last Updated" date.
                </p>
              </div>
            </section>

            <section className="border-t pt-6 mt-8">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Contact Us
              </h2>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-muted-foreground mb-2">
                  If you have questions about this Privacy Policy or how we handle your information, please contact us:
                </p>
                <div className="text-sm space-y-1">
                  <p><strong>Clean Machine Auto Detail</strong></p>
                  <p>Phone: <a href="tel:9182899274" className="text-blue-600 dark:text-blue-400 hover:underline">(918) 289-9274</a></p>
                  <p>Website: <a href="https://cleanmachinetulsa.com" className="text-blue-600 dark:text-blue-400 hover:underline">cleanmachinetulsa.com</a></p>
                  <p>SMS Consent: <a href="https://cleanmachinetulsa.com/sms-consent" className="text-blue-600 dark:text-blue-400 hover:underline">cleanmachinetulsa.com/sms-consent</a></p>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
