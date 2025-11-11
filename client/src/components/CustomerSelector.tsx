import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vehicleInfo: string | null;
  lastInteraction: Date | null;
}

interface CustomerSelectorProps {
  value?: string; // phone number
  onValueChange: (customer: Customer) => void;
}

export function CustomerSelector({ value, onValueChange }: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch customers with optional search
  const { data: customersData, isLoading } = useQuery<{ success: boolean; customers: Customer[] }>({
    queryKey: ['/api/customers', searchQuery],
    queryFn: async () => {
      const url = searchQuery 
        ? `/api/customers?search=${encodeURIComponent(searchQuery)}`
        : '/api/customers';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      return response.json();
    },
    enabled: open, // Only fetch when dropdown is open
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch current customer data to show immediately (before dropdown opens)
  const { data: currentCustomerData } = useQuery<{ success: boolean; customers: Customer[] }>({
    queryKey: ['/api/customers'],
    queryFn: async () => {
      const response = await fetch('/api/customers');
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      return response.json();
    },
    enabled: !!value, // Only fetch if there's a selected value
    staleTime: 60000,
  });

  const customers = customersData?.customers || [];
  const currentCustomers = currentCustomerData?.customers || [];
  
  // Find selected customer from either the search results or the initial fetch
  const selectedCustomer = customers.find((customer) => customer.phone === value) 
    || currentCustomers.find((customer) => customer.phone === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-blue-200 hover:bg-blue-50"
          data-testid="button-customer-selector"
        >
          <div className="flex items-center gap-2 flex-1 text-left overflow-hidden">
            <Search className="h-4 w-4 text-blue-500 flex-shrink-0" />
            {selectedCustomer ? (
              <span className="truncate">
                {selectedCustomer.name}
                {selectedCustomer.phone && (
                  <span className="text-xs text-gray-500 ml-2">
                    {selectedCustomer.phone}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-gray-500">Select a customer...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search customers..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            data-testid="input-customer-search"
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading customers..." : "No customers found."}
            </CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.phone || ''}
                  onSelect={() => {
                    onValueChange(customer);
                    setOpen(false);
                  }}
                  data-testid={`option-customer-${customer.id}`}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === customer.phone ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{customer.name}</span>
                      {customer.phone && (
                        <span className="text-xs text-gray-500 ml-2">
                          {customer.phone}
                        </span>
                      )}
                    </div>
                    {(customer.email || customer.address) && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {customer.email && <span>{customer.email}</span>}
                        {customer.email && customer.address && <span className="mx-2">•</span>}
                        {customer.address && <span className="truncate">{customer.address}</span>}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
