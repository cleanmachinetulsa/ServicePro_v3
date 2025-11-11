import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Save, Pencil, DollarSign } from "lucide-react";

interface ServiceInfo {
  name: string;
  priceRange: string;
  description: string;
  overview?: string;
  detailedDescription?: string;
  duration: string;
  durationHours: number;
  isAddon?: boolean;
  imageUrl?: string;
}

export default function ServicesManagement() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [isEditingService, setIsEditingService] = useState(false);
  const [serviceType, setServiceType] = useState<'main' | 'addon'>('main');
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const [servicesRes, addonsRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/addon-services')
      ]);
      
      const servicesData = await servicesRes.json();
      const addonsData = await addonsRes.json();
      
      if (servicesData.success && addonsData.success) {
        const mainServices = servicesData.services.map((s: any) => ({
          ...s,
          isAddon: false,
          priceRange: s.priceRange || s.price,
          overview: s.overview || s.description
        }));
        
        const addonServices = addonsData.addOns.map((a: any) => ({
          name: a.name,
          priceRange: a.price,
          description: a.description || a.overview,
          overview: a.overview,
          detailedDescription: a.detailedDescription || '',
          duration: '30 minutes',
          durationHours: 0.5,
          isAddon: true,
          imageUrl: a.imageUrl
        }));
        
        setServices([...mainServices, ...addonServices]);
      }
    } catch (error) {
      toast({
        title: "Error loading services",
        description: "Failed to fetch services data",
        variant: "destructive"
      });
    }
  };

  const handleServiceEdit = () => {
    setIsEditingService(true);
  };

  const handleServiceSave = async () => {
    if (!selectedService) return;

    try {
      const endpoint = selectedService.isAddon ? '/api/addon-services/update' : '/api/services/update';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedService.name,
          priceRange: selectedService.priceRange,
          overview: selectedService.overview,
          detailedDescription: selectedService.detailedDescription
        })
      });

      if (response.ok) {
        toast({
          title: "Service updated",
          description: "Changes have been saved successfully"
        });
        setIsEditingService(false);
        setSelectedService(null);
        await fetchServices();
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to save service changes",
        variant: "destructive"
      });
    }
  };

  const handleImageUpload = async (service: ServiceInfo, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('/api/upload-service-image', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      if (data.success) {
        await fetch('/api/save-service-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceName: service.name,
            imageUrl: data.imageUrl
          })
        });
        
        setServices(services.map(s => 
          s.name === service.name ? { ...s, imageUrl: data.imageUrl } : s
        ));
        
        toast({
          title: "Image uploaded",
          description: `${service.isAddon ? 'Add-on' : 'Service'} image has been updated`
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image",
        variant: "destructive"
      });
    }
  };

  const filteredServices = services.filter(service => 
    serviceType === 'main' ? !service.isAddon : service.isAddon
  );

  return (
    <div className="space-y-6">
      <Card className="bg-blue-50/95 dark:bg-gray-800/95">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
            <DollarSign className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
            Manage Services & Add-ons
          </CardTitle>
          <CardDescription>
            View and update your service offerings, pricing, and descriptions
          </CardDescription>
          <div className="flex items-center justify-between pt-4">
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  serviceType === 'main' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-transparent text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-gray-600'
                }`}
                onClick={() => setServiceType('main')}
              >
                Main Services
              </button>
              <button
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  serviceType === 'addon' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-transparent text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-gray-600'
                }`}
                onClick={() => setServiceType('addon')}
              >
                Add-ons
              </button>
            </div>
            {isEditingService ? (
              <Button onClick={handleServiceSave} className="bg-blue-600 hover:bg-blue-700">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            ) : (
              <Button onClick={handleServiceEdit} className="bg-blue-600 hover:bg-blue-700">
                <Pencil className="h-4 w-4 mr-2" />
                Edit Services
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-blue-900 dark:text-blue-100">Image</TableHead>
                <TableHead className="text-blue-900 dark:text-blue-100">Service Name</TableHead>
                <TableHead className="text-blue-900 dark:text-blue-100">Price Range</TableHead>
                <TableHead className="text-blue-900 dark:text-blue-100">Overview</TableHead>
                <TableHead className="text-blue-900 dark:text-blue-100">Detailed Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map((service) => (
                <TableRow 
                  key={service.name}
                  className={selectedService?.name === service.name ? "bg-blue-100 dark:bg-gray-700" : "transition-all hover:shadow-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"}
                  onClick={() => setSelectedService(service)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-2 items-center">
                      {service.imageUrl && (
                        <img 
                          src={service.imageUrl} 
                          alt={service.name}
                          className="w-20 h-20 object-cover rounded-md"
                        />
                      )}
                      <input
                        id={`file-upload-${service.name}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(service, file);
                        }}
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs"
                        type="button"
                        onClick={() => document.getElementById(`file-upload-${service.name}`)?.click()}
                        data-testid={`button-upload-image-${service.name}`}
                      >
                        {service.imageUrl ? 'Change' : 'Upload'} Image
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {isEditingService && selectedService?.name === service.name ? (
                      <Input 
                        value={selectedService.name}
                        onChange={(e) => setSelectedService({...selectedService, name: e.target.value})}
                      />
                    ) : (
                      service.name
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditingService && selectedService?.name === service.name ? (
                      <Input 
                        value={selectedService.priceRange}
                        onChange={(e) => setSelectedService({...selectedService, priceRange: e.target.value})}
                      />
                    ) : (
                      service.priceRange
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditingService && selectedService?.name === service.name ? (
                      <Input 
                        value={selectedService.overview}
                        onChange={(e) => setSelectedService({...selectedService, overview: e.target.value})}
                        placeholder="Brief overview for service card"
                      />
                    ) : (
                      service.overview
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditingService && selectedService?.name === service.name ? (
                      <textarea 
                        className="w-full min-h-[100px] p-2 border rounded-md"
                        value={selectedService.detailedDescription}
                        onChange={(e) => setSelectedService({...selectedService, detailedDescription: e.target.value})}
                        placeholder="Detailed description with bullet points (use • or - for bullets)"
                      />
                    ) : (
                      <div className="max-w-md text-sm whitespace-pre-line">
                        {service.detailedDescription}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
