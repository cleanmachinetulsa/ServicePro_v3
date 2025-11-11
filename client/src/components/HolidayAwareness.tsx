import React from 'react';

export interface Holiday {
  name: string;
  date: string; // Format: MM-DD
  greeting: string;
  enabled: boolean;
}

export const defaultHolidays: Holiday[] = [
  {
    name: "New Year's Day",
    date: "01-01",
    greeting: "Happy New Year! Here's to a fresh start for your vehicle in {year}!",
    enabled: true
  },
  {
    name: "Valentine's Day",
    date: "02-14",
    greeting: "Happy Valentine's Day! Give your car some love with our premium detailing services!",
    enabled: true
  },
  {
    name: "St. Patrick's Day",
    date: "03-17",
    greeting: "Happy St. Patrick's Day! Your luck just got better with our special cleaning services!",
    enabled: true
  },
  {
    name: "Easter",
    date: "04-09", // This varies each year
    greeting: "Happy Easter! Spring into a fresh start with a professionally detailed vehicle!",
    enabled: true
  },
  {
    name: "Mother's Day",
    date: "05-14", // Second Sunday in May
    greeting: "Happy Mother's Day! Treat Mom to a sparkling clean vehicle this year!",
    enabled: true
  },
  {
    name: "Memorial Day",
    date: "05-29", // Last Monday in May
    greeting: "Happy Memorial Day weekend! Remember to book your detail before the summer rush!",
    enabled: true
  },
  {
    name: "Father's Day",
    date: "06-18", // Third Sunday in June
    greeting: "Happy Father's Day! Dad deserves a fresh, clean ride - book a detail today!",
    enabled: true
  },
  {
    name: "Independence Day",
    date: "07-04",
    greeting: "Happy 4th of July! Celebrate freedom with a freshly detailed vehicle!",
    enabled: true
  },
  {
    name: "Labor Day",
    date: "09-04", // First Monday in September
    greeting: "Happy Labor Day weekend! End summer with a professionally detailed vehicle!",
    enabled: true
  },
  {
    name: "Halloween",
    date: "10-31",
    greeting: "Happy Halloween! No tricks, just treats for your vehicle with our premium services!",
    enabled: true
  },
  {
    name: "Thanksgiving",
    date: "11-23", // Fourth Thursday in November
    greeting: "Happy Thanksgiving! We're thankful for customers like you. Book your holiday detail now!",
    enabled: true
  },
  {
    name: "Christmas",
    date: "12-25",
    greeting: "Merry Christmas! Give your vehicle the gift of a professional detail this holiday season!",
    enabled: true
  }
];

export function isHolidaySoon(days: number = 7): Holiday | null {
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // Check if any holiday is within the specified days
  for (const holiday of defaultHolidays) {
    if (!holiday.enabled) continue;
    
    const [month, day] = holiday.date.split('-').map(Number);
    const holidayDate = new Date(currentYear, month - 1, day);
    
    // Adjust if the holiday has already passed this year
    if (holidayDate < today) {
      holidayDate.setFullYear(currentYear + 1);
    }
    
    // Calculate the difference in days
    const diffTime = holidayDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 0 && diffDays <= days) {
      return holiday;
    }
  }
  
  return null;
}

export function formatHolidayGreeting(greeting: string): string {
  return greeting.replace('{year}', new Date().getFullYear().toString());
}

export function getCurrentHoliday(): Holiday | null {
  const today = new Date();
  const currentDate = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  for (const holiday of defaultHolidays) {
    if (holiday.enabled && holiday.date === currentDate) {
      return holiday;
    }
  }
  
  return null;
}

export function HolidayAwarenessTable({ 
  holidays, 
  onToggle,
  onUpdateGreeting
}: { 
  holidays: Holiday[], 
  onToggle: (index: number) => void,
  onUpdateGreeting: (index: number, greeting: string) => void
}): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full bg-white shadow-md rounded-lg overflow-hidden">
        <thead className="bg-blue-600 text-white">
          <tr>
            <th className="px-4 py-3 text-left">Holiday</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Greeting</th>
            <th className="px-4 py-3 text-center">Enabled</th>
          </tr>
        </thead>
        <tbody>
          {holidays.map((holiday, index) => (
            <tr key={holiday.name} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
              <td className="px-4 py-3 text-gray-800 font-medium">{holiday.name}</td>
              <td className="px-4 py-3 text-gray-600">{holiday.date}</td>
              <td className="px-4 py-3 text-gray-600">
                <textarea 
                  value={holiday.greeting}
                  onChange={(e) => onUpdateGreeting(index, e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  rows={2}
                />
              </td>
              <td className="px-4 py-3 text-center">
                <input 
                  type="checkbox" 
                  checked={holiday.enabled} 
                  onChange={() => onToggle(index)}
                  className="h-5 w-5 text-blue-600 rounded"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}