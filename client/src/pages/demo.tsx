import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Calendar, User, CloudRain, Car } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Import key components for the demo
import { WeatherForecast } from '@/components/WeatherForecast';
import WeatherAlertDialog from '@/components/WeatherAlertDialog';

// Demo data
const DEMO_CUSTOMERS = [
  { name: 'John Demo', phone: '555-123-4567', vehicle: '2020 Tesla Model 3 (Blue)', email: 'john@example.com' },
  { name: 'Sarah Test', phone: '555-987-6543', vehicle: '2019 Toyota Camry (Black)', email: 'sarah@example.com' },
  { name: 'Demo User', phone: '555-555-5555', vehicle: '2022 Honda Accord (Red)', email: 'demo@example.com' },
];

const DEMO_SERVICES = [
  { name: 'Full Detail', price: '$225-300', description: 'Complete interior + exterior reconditioning', duration: '2-4 hours' },
  { name: 'Interior Detail', price: '$150-250', description: 'Deep clean interior surfaces', duration: '1.5-3 hours' },
  { name: 'Premium Wash', price: '$75', description: 'Exterior hand wash + wheels & tires', duration: '45 minutes' },
];

const DEMO_WEATHER_LEVELS = [
  { label: 'Low Risk (0-15%)', value: 'low', precipChance: 10 },
  { label: 'Moderate Risk (15-25%)', value: 'moderate', precipChance: 20 },
  { label: 'High Risk (25-60%)', value: 'high', precipChance: 45 },
  { label: 'Very High Risk (60-80%)', value: 'very-high', precipChance: 70 },
  { label: 'Severe Risk (80-100%)', value: 'severe', precipChance: 90 },
];

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState('chatbot');
  const [showWeatherAlert, setShowWeatherAlert] = useState(false);
  const [selectedWeatherRisk, setSelectedWeatherRisk] = useState(DEMO_WEATHER_LEVELS[0]);
  const { toast } = useToast();
  
  useEffect(() => {
    // 1. Activate demo mode on the server
    fetch('/api/toggle-demo-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }).then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('Demo mode activated');
          
          // 2. Get demo access token for security
          return fetch('/api/demo/access-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })
      .then(res => res?.json())
      .then(data => {
        if (data?.success) {
          // Store the demo token in session storage
          sessionStorage.setItem('demoAccessToken', data.token);
          console.log(`Demo access granted until ${new Date(data.expires).toLocaleTimeString()}`);
          
          // 3. Add watermark to the page
          const watermark = document.createElement('div');
          watermark.style.position = 'fixed';
          watermark.style.bottom = '10px';
          watermark.style.right = '10px';
          watermark.style.opacity = '0.7';
          watermark.style.zIndex = '9999';
          watermark.style.padding = '5px 10px';
          watermark.style.borderRadius = '3px';
          watermark.style.backgroundColor = 'rgba(0,0,0,0.1)';
          watermark.style.color = '#555';
          watermark.style.fontSize = '12px';
          watermark.style.pointerEvents = 'none';
          watermark.style.fontFamily = 'Arial, sans-serif';
          watermark.textContent = 'Clean Machine Auto Detail Demo';
          document.body.appendChild(watermark);
        }
      })
      .catch(err => console.error('Error setting up demo environment:', err));
      
    // Clean up - disable demo mode when leaving the page
    return () => {
      // Clear the demo token
      sessionStorage.removeItem('demoAccessToken');
      
      // Disable demo mode on the server
      fetch('/api/toggle-demo-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      }).catch(err => console.error('Error deactivating demo mode:', err));
    };
  }, []);

  const simulateBooking = () => {
    toast({
      title: "Booking Simulated",
      description: "A demo booking confirmation would be sent via SMS and email.",
    });
  };
  
  const simulateWeatherAlert = () => {
    setShowWeatherAlert(true);
  };
  
  return (
    <div className="container mx-auto py-8">
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg p-6 mb-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Clean Machine Auto Detail Agent</h1>
        <p className="text-lg opacity-90">Interactive Demo Experience</p>
        <p className="mt-2 text-sm bg-blue-700 inline-block px-3 py-1 rounded-full">This is a demonstration environment - no real messages will be sent</p>
      </div>
      
      <WeatherAlertDialog 
        open={showWeatherAlert}
        onOpenChange={setShowWeatherAlert}
        onProceed={() => {
          setShowWeatherAlert(false);
          toast({ 
            title: "Proceeding with Appointment", 
            description: "We'll monitor the weather and notify you of any changes."
          });
        }}
        onReschedule={() => {
          setShowWeatherAlert(false);
          toast({ 
            title: "Rescheduling Requested", 
            description: "You've chosen to reschedule due to weather conditions."
          });
        }}
        weatherRiskLevel={selectedWeatherRisk.value as any}
        precipitationChance={selectedWeatherRisk.precipChance}
        date="May 20, 2025"
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <Tabs defaultValue="chatbot" onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-5">
                  <TabsTrigger value="chatbot" className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Chatbot</span>
                  </TabsTrigger>
                  <TabsTrigger value="booking" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Booking</span>
                  </TabsTrigger>
                  <TabsTrigger value="customers" className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Customers</span>
                  </TabsTrigger>
                  <TabsTrigger value="weather" className="flex items-center">
                    <CloudRain className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Weather</span>
                  </TabsTrigger>
                  <TabsTrigger value="services" className="flex items-center">
                    <Car className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Services</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="min-h-[600px]">
              <TabsContent value="chatbot" className="space-y-4 mt-0">
                <div className="py-4">
                  <h3 className="text-lg font-medium mb-4 text-center">Interactive Chatbot Demo</h3>
                  <div className="bg-gray-100 p-4 rounded-lg text-left max-w-md mx-auto shadow-sm">
                    <div className="bg-blue-500 text-white p-3 rounded-lg inline-block mb-4">
                      👋 Hi there! I'm the Clean Machine Auto Detail assistant. How can I help you today?
                    </div>
                    
                    <div className="bg-gray-200 p-3 rounded-lg inline-block mb-4 float-right">
                      I'd like to book a full detail for my Tesla Model 3.
                    </div>
                    
                    <div className="bg-blue-500 text-white p-3 rounded-lg inline-block mb-4 clear-right">
                      Great choice! I'd be happy to help you book a Full Detail service for your Tesla Model 3. Our Full Detail includes complete interior and exterior reconditioning and costs between $225-300.
                    </div>
                    
                    <div className="bg-gray-200 p-3 rounded-lg inline-block mb-4 float-right">
                      What does the full detail include exactly?
                    </div>
                    
                    <div className="bg-blue-500 text-white p-3 rounded-lg inline-block mb-4 clear-right">
                      Our Full Detail service includes:<br/><br/>
                      <strong>Interior:</strong> Deep vacuum of all surfaces, carpet/upholstery shampooing, leather cleaning & conditioning, dashboard & panel cleaning, console detailing, window cleaning, and UV protectant application.<br/><br/>
                      <strong>Exterior:</strong> Hand wash, clay bar treatment, machine polishing (minor scratches), ceramic spray wax application, wheel cleaning & tire dressing, trim restoration, and headlight restoration if needed.<br/><br/>
                      We spend 2-4 hours ensuring your Tesla looks showroom-ready. Would you like to schedule an appointment?
                    </div>
                    
                    <div className="bg-gray-200 p-3 rounded-lg inline-block mb-4 float-right">
                      Yes, I'd like to book for next Tuesday morning if possible.
                    </div>
                    
                    <div className="bg-blue-500 text-white p-3 rounded-lg inline-block mb-4 clear-right">
                      Perfect! Let me check our availability for next Tuesday morning.<br/><br/>
                      We have the following slots available on Tuesday:<br/>
                      - 9:00 AM<br/>
                      - 10:30 AM<br/>
                      - 1:00 PM<br/><br/>
                      Which time works best for you? Also, could you provide your address so I can confirm you're within our service area?
                    </div>
                    
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2 no-scrollbar">
                      <button className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm whitespace-nowrap border border-blue-100">9:00 AM</button>
                      <button className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm whitespace-nowrap border border-blue-100">10:30 AM</button>
                      <button className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm whitespace-nowrap border border-blue-100">1:00 PM</button>
                      <button className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm whitespace-nowrap border border-blue-100">Check other days</button>
                    </div>
                    
                    <div className="mt-6 border-t pt-4 flex">
                      <input 
                        type="text" 
                        className="flex-1 p-2 border rounded-l-md focus:outline-none" 
                        placeholder="Type a message..."
                        disabled
                      />
                      <button className="bg-blue-500 text-white px-4 py-2 rounded-r-md">Send</button>
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-gray-50 p-3 rounded border text-sm text-gray-600 max-w-md mx-auto">
                    <p className="font-medium mb-2">Demo Features:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Natural language processing understands customer inquiries</li>
                      <li>Detailed service information with accurate pricing</li>
                      <li>Automatic appointment scheduling suggestions</li>
                      <li>Location verification within service area</li>
                      <li>Conversation memory for personalized service</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="booking" className="space-y-4 mt-0">
                <div className="text-center py-4">
                  <h3 className="text-lg font-medium mb-4">Appointment Booking Demo</h3>
                  <p className="text-gray-500 mb-6">Book a service and receive confirmation messages.</p>
                  
                  <div className="bg-white border rounded-lg p-4 max-w-md mx-auto text-left">
                    <h4 className="font-medium mb-2">Select a Service</h4>
                    <div className="space-y-2 mb-4">
                      {DEMO_SERVICES.map((service, idx) => (
                        <div 
                          key={idx}
                          className="border rounded p-3 hover:bg-blue-50 cursor-pointer"
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">{service.name}</span>
                            <span className="text-blue-600">{service.price}</span>
                          </div>
                          <p className="text-sm text-gray-600">{service.description}</p>
                          <div className="text-xs text-gray-500 mt-1">
                            Estimated Duration: {service.duration}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <Button onClick={simulateBooking}>Book Appointment</Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="customers" className="space-y-4 mt-0">
                <div className="text-center py-4">
                  <h3 className="text-lg font-medium mb-4">Customer Management Demo</h3>
                  <p className="text-gray-500 mb-6">View and manage customer information.</p>
                  
                  <div className="bg-white border rounded-lg p-4 max-w-md mx-auto">
                    <h4 className="font-medium mb-2 text-left">Demo Customers</h4>
                    <div className="space-y-3">
                      {DEMO_CUSTOMERS.map((customer, idx) => (
                        <div 
                          key={idx}
                          className="border rounded p-3 text-left"
                        >
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-gray-600">
                            <div>Phone: {customer.phone}</div>
                            <div>Email: {customer.email}</div>
                            <div>Vehicle: {customer.vehicle}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="weather" className="mt-0">
                <div className="text-center py-4">
                  <h3 className="text-lg font-medium mb-4">Weather Alert System Demo</h3>
                  <p className="text-gray-500 mb-6">See how our weather risk management system works.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white border rounded-lg p-4 text-left">
                      <h4 className="font-medium mb-2">Test Weather Alerts</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Select a weather risk level to preview alerts.
                      </p>
                      
                      <div className="space-y-2">
                        {DEMO_WEATHER_LEVELS.map((level, idx) => (
                          <div 
                            key={idx}
                            className={`border rounded p-2 cursor-pointer flex items-center
                              ${selectedWeatherRisk.value === level.value ? 'border-blue-500 bg-blue-50' : ''}
                            `}
                            onClick={() => setSelectedWeatherRisk(level)}
                          >
                            <input 
                              type="radio" 
                              checked={selectedWeatherRisk.value === level.value}
                              readOnly
                              className="mr-2"
                            />
                            <span>{level.label}</span>
                          </div>
                        ))}
                      </div>
                      
                      <Button className="mt-4" onClick={simulateWeatherAlert}>
                        Show Weather Alert
                      </Button>
                    </div>
                    
                    <div className="bg-white border rounded-lg p-4 text-left">
                      <h4 className="font-medium mb-2">Weather Risk Levels</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                          <span>Low (0-15%): Good for service</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
                          <span>Moderate (15-25%): May affect exterior detailing</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-orange-400 mr-2"></div>
                          <span>High (25-60%): Consider rescheduling</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                          <span>Very High (60-80%): Rescheduling recommended</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-red-600 mr-2"></div>
                          <span>Severe (80-100%): Strongly recommend rescheduling</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <WeatherForecast />
                </div>
              </TabsContent>
              
              <TabsContent value="services" className="mt-0">
                <div className="text-center py-4">
                  <h3 className="text-lg font-medium mb-4">Services Management Demo</h3>
                  <p className="text-gray-500 mb-6">View and manage service offerings.</p>
                  
                  <div className="bg-white border rounded-lg p-4 text-left max-w-3xl mx-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Service</th>
                          <th className="text-left p-2">Price Range</th>
                          <th className="text-left p-2">Duration</th>
                          <th className="text-left p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEMO_SERVICES.map((service, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-medium">{service.name}</td>
                            <td className="p-2">{service.price}</td>
                            <td className="p-2">{service.duration}</td>
                            <td className="p-2">{service.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Clean Machine Auto Detail</CardTitle>
              <CardDescription>AI-Powered Business Assistant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTitle>Demo Environment</AlertTitle>
                <AlertDescription>
                  You're viewing a demonstration version of the Clean Machine Auto Detail Agent. No real messages or appointments will be created.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <h3 className="font-medium">Key Features:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Intelligent appointment scheduling</li>
                  <li>Weather-aware booking system</li>
                  <li>Customer management & history</li>
                  <li>SMS & email notifications</li>
                  <li>Service area validation</li>
                  <li>Payment processing</li>
                </ul>
              </div>
              
              <Button className="w-full" variant="outline" onClick={() => window.open('/documentation.pdf', '_blank')}>
                View Full Documentation
              </Button>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/'}>
                Exit Demo
              </Button>
              <Button size="sm" onClick={() => window.location.href = 'mailto:info@cleanmachineautodetail.com'}>
                Contact Us
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}