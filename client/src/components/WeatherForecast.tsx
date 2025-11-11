import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  CloudDrizzle, 
  CloudLightning, 
  Sun, 
  AlertTriangle, 
  Umbrella
} from "lucide-react";
import { format, parseISO } from 'date-fns';

// Types matching the server-side types
interface WeatherForecast {
  date: string;
  description: string;
  chanceOfRain: number;
  temperature: number;
  isRainy: boolean;
  severity: 'none' | 'low' | 'moderate' | 'high' | 'severe';
}

interface WeatherCheckResult {
  needsReschedule: boolean;
  forecastData: WeatherForecast[];
  recommendation: string;
  urgency: 'none' | 'low' | 'medium' | 'high';
}

interface WeatherForecastProps {
  appointmentLocation?: string;
  appointmentDate?: string;
  latitude?: number;
  longitude?: number;
}

export const WeatherForecast: React.FC<WeatherForecastProps> = ({
  appointmentLocation,
  appointmentDate,
  latitude = 36.1236407, // Default to Tulsa coordinates
  longitude = -95.9359214,
}) => {
  const [loading, setLoading] = useState(false);
  const [forecastData, setForecastData] = useState<WeatherForecast[]>([]);
  const [appointmentWeather, setAppointmentWeather] = useState<WeatherCheckResult | null>(null);
  const [activeTab, setActiveTab] = useState<'forecast' | 'appointment' | '24hour'>('forecast');
  const { toast } = useToast();

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/weather-forecast?latitude=${latitude}&longitude=${longitude}&days=4`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch weather forecast');
      }
      
      const data = await response.json();
      
      if (data.success && data.forecast) {
        setForecastData(data.forecast);
      } else {
        throw new Error(data.error || 'Failed to fetch weather data');
      }
    } catch (error: any) {
      console.error('Error fetching weather forecast:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load weather forecast",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkAppointmentWeather = async () => {
    if (!appointmentDate) {
      toast({
        title: "No appointment selected",
        description: "Please select an appointment to check weather",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/appointment-weather?latitude=${latitude}&longitude=${longitude}&date=${appointmentDate}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to check appointment weather');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAppointmentWeather(data);
        setActiveTab('appointment');
      } else {
        throw new Error(data.error || 'Failed to check appointment weather');
      }
    } catch (error: any) {
      console.error('Error checking appointment weather:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to check appointment weather",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Group forecasts by day
  const groupedForecasts = forecastData.reduce((groups, forecast) => {
    const date = forecast.date.split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(forecast);
    return groups;
  }, {} as Record<string, WeatherForecast[]>);
  
  // Get next 24 hours forecast data
  const next24HoursForecast = forecastData
    .filter(forecast => {
      const forecastTime = new Date(forecast.date).getTime();
      const now = new Date().getTime();
      const hoursDiff = (forecastTime - now) / (1000 * 60 * 60);
      return hoursDiff >= 0 && hoursDiff <= 24;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  useEffect(() => {
    fetchForecast();
  }, [latitude, longitude]);

  // Get weather icon based on forecast
  const getWeatherIcon = (forecast: WeatherForecast) => {
    const description = forecast.description.toLowerCase();
    const size = 18;
    
    if (description.includes('thunder')) {
      return <CloudLightning size={size} className="text-yellow-500" />;
    } else if (description.includes('snow')) {
      return <CloudSnow size={size} className="text-blue-200" />;
    } else if (description.includes('rain') || forecast.isRainy) {
      return <CloudRain size={size} className="text-blue-500" />;
    } else if (description.includes('drizzle')) {
      return <CloudDrizzle size={size} className="text-blue-400" />;
    } else if (description.includes('cloud')) {
      return <Cloud size={size} className="text-gray-500" />;
    } else {
      return <Sun size={size} className="text-yellow-400" />;
    }
  };

  // Get color for rain probability
  const getRainProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-red-500';
    if (probability >= 50) return 'text-orange-500';
    if (probability >= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Format the date nicely
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return format(date, 'EEE, MMM d');
  };

  // Format the time nicely
  const formatTime = (dateString: string) => {
    const date = parseISO(dateString);
    return format(date, 'h:mm a');
  };

  // Get severity indicator
  const getSeverityIndicator = (severity: string) => {
    const severityMap = {
      'none': { color: 'bg-green-500 bg-opacity-20 text-green-800', icon: null },
      'low': { color: 'bg-green-500 bg-opacity-20 text-green-800', icon: <Umbrella size={12} className="ml-1" /> },
      'moderate': { color: 'bg-yellow-400 bg-opacity-30 text-yellow-800', icon: <Umbrella size={12} className="ml-1" /> },
      'high': { color: 'bg-orange-400 bg-opacity-25 text-orange-800', icon: <Umbrella size={12} className="ml-1" /> },
      'very-high': { color: 'bg-orange-500 bg-opacity-30 text-orange-800', icon: <AlertTriangle size={12} className="ml-1" /> },
      'severe': { color: 'bg-red-600 bg-opacity-20 text-red-800', icon: <AlertTriangle size={12} className="ml-1" /> },
    };
    
    // Type safety for severity values
    const severityKey = (severity in severityMap) ? 
      severity as keyof typeof severityMap : 
      'none';
    
    const severityInfo = severityMap[severityKey];
    
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center ${severityInfo.color}`}>
        {severity}
        {severityInfo.icon}
      </span>
    );
  };

  return (
    <div className="weather-forecast space-y-4">
      <div className="flex gap-2 mb-4">
        <Button 
          variant={activeTab === 'forecast' ? "default" : "outline"} 
          size="sm"
          onClick={() => setActiveTab('forecast')}
        >
          <Cloud className="h-4 w-4 mr-2" />
          4-Day Forecast
        </Button>
        
        <Button 
          variant={activeTab === '24hour' ? "default" : "outline"} 
          size="sm"
          onClick={() => setActiveTab('24hour')}
        >
          <CloudRain className="h-4 w-4 mr-2" />
          24-Hour Forecast
        </Button>
        
        {appointmentDate && (
          <Button 
            variant={activeTab === 'appointment' ? "default" : "outline"} 
            size="sm"
            onClick={() => {
              if (appointmentWeather) {
                setActiveTab('appointment');
              } else {
                checkAppointmentWeather();
              }
            }}
          >
            <Umbrella className="h-4 w-4 mr-2" />
            Appointment Check
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={fetchForecast}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : activeTab === '24hour' ? (
        // 24-Hour Forecast View
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-3">Next 24 Hours Weather Forecast</h3>
              
              {next24HoursForecast.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between items-center bg-muted p-2 rounded text-sm font-medium">
                    <span>Time</span>
                    <div className="flex items-center gap-4">
                      <span>Rain %</span>
                      <span>Temp</span>
                      <span>Risk</span>
                    </div>
                  </div>
                  
                  {next24HoursForecast.map((forecast, idx) => (
                    <div key={idx} className={`flex items-center justify-between border rounded p-2 text-sm ${forecast.isRainy ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-center">
                        {getWeatherIcon(forecast)}
                        <span className="ml-2 font-mono">{formatTime(forecast.date)}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`w-12 text-right ${getRainProbabilityColor(forecast.chanceOfRain)}`}>
                          {forecast.chanceOfRain}%
                        </span>
                        <span className="w-10 text-right">{forecast.temperature}°F</span>
                        <div className="w-20 text-right">
                          {forecast.isRainy && getSeverityIndicator(forecast.severity)}
                          {!forecast.isRainy && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">Clear</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No weather data available for the next 24 hours
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : activeTab === 'forecast' ? (
        // 4-Day Forecast View
        <div className="space-y-4">
          {Object.keys(groupedForecasts).length > 0 ? (
            Object.entries(groupedForecasts).map(([date, forecasts]) => (
              <Card key={date} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{formatDate(forecasts[0].date)}</h3>
                    <div className="text-sm text-muted-foreground">
                      {forecasts.some(f => f.isRainy) ? (
                        <span className="flex items-center text-blue-500">
                          <CloudRain size={16} className="mr-1" />
                          Rain Expected
                        </span>
                      ) : (
                        <span className="flex items-center text-green-500">
                          <Sun size={16} className="mr-1" />
                          Clear
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {forecasts.map((forecast, idx) => (
                      <div key={idx} className="flex items-center justify-between border rounded p-2 text-sm">
                        <div className="flex items-center">
                          {getWeatherIcon(forecast)}
                          <span className="ml-2">{formatTime(forecast.date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={getRainProbabilityColor(forecast.chanceOfRain)}>
                            {forecast.chanceOfRain}%
                          </span>
                          <span>{forecast.temperature}°F</span>
                          {forecast.isRainy && getSeverityIndicator(forecast.severity)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center p-4 text-gray-500">
              No weather data available
            </div>
          )}
        </div>
      ) : (
        // Appointment Weather Check View
        <div>
          {appointmentWeather ? (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      {appointmentDate ? formatDate(appointmentDate) : 'Appointment Weather'}
                    </h3>
                    <div>
                      {appointmentWeather.needsReschedule ? (
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                          Reschedule Recommended
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Good for Detailing
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded border">
                    <p className="text-sm">{appointmentWeather.recommendation}</p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Hourly Forecast</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {appointmentWeather.forecastData.map((forecast, idx) => (
                        <div key={idx} className="flex items-center justify-between border rounded p-2 text-sm">
                          <div className="flex items-center">
                            {getWeatherIcon(forecast)}
                            <span className="ml-2">{formatTime(forecast.date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={getRainProbabilityColor(forecast.chanceOfRain)}>
                              {forecast.chanceOfRain}%
                            </span>
                            <span>{forecast.temperature}°F</span>
                            {forecast.isRainy && getSeverityIndicator(forecast.severity)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {appointmentWeather.needsReschedule && (
                    <div className="mt-4">
                      <Button variant="destructive" size="sm">
                        <Umbrella className="h-4 w-4 mr-2" />
                        Reschedule Appointment
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center p-4">
              <Button onClick={checkAppointmentWeather} disabled={loading}>
                Check Appointment Weather
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeatherForecast;