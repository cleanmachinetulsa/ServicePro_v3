import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import SettingsWorkspace from '@/components/SettingsWorkspace';
import BackNavigation from '@/components/BackNavigation';
import { Settings as SettingsIcon } from 'lucide-react';
import { settingsSections, findSectionForItem, isValidItem, isSectionValid } from '@/config/settingsSections';

export default function SettingsAdmin() {
  const [, params] = useRoute('/settings/:section?/:item?');
  const [location, setLocation] = useLocation();
  const [initialSection, setInitialSection] = useState<string | undefined>();
  const [initialItem, setInitialItem] = useState<string | undefined>();

  useEffect(() => {
    if (!params) {
      // No params - use default (operations/services)
      setInitialSection('operations');
      setInitialItem('services');
      return;
    }

    const { section, item } = params;

    // Case 1: Both section and item provided
    if (section && item) {
      // Validate that the item exists in the section
      if (isValidItem(section, item)) {
        setInitialSection(section);
        setInitialItem(item);
      } else {
        // Invalid combination - redirect to default
        console.warn(`Invalid settings path: section=${section}, item=${item}`);
        setLocation('/settings');
      }
      return;
    }

    // Case 2: Only section provided (treat as item for backward compatibility)
    if (section && !item) {
      // First, check if it's a valid section ID
      if (isSectionValid(section)) {
        // It's a section - use the first item in that section
        const sectionData = settingsSections.find(s => s.id === section);
        if (sectionData && sectionData.items.length > 0) {
          setInitialSection(section);
          setInitialItem(sectionData.items[0].id);
        }
      } else {
        // Treat it as an item ID and find its section
        const foundSection = findSectionForItem(section);
        if (foundSection) {
          setInitialSection(foundSection);
          setInitialItem(section);
        } else {
          // Invalid - redirect to default
          console.warn(`Invalid settings path: ${section}`);
          setLocation('/settings');
        }
      }
      return;
    }

    // Default case
    setInitialSection('operations');
    setInitialItem('services');
  }, [params, setLocation]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-4">
        <BackNavigation fallbackPath="/dashboard" />
      </div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your business operations, customers, communications, and more
        </p>
      </div>

      <SettingsWorkspace 
        initialSection={initialSection}
        initialItem={initialItem}
      />
    </div>
  );
}
