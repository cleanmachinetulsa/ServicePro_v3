/**
 * Contact Picker Component
 * 
 * Reusable contact selection with:
 * - Real-time search (phone, email, name)
 * - Duplicate detection warnings
 * - Inline contact creation
 * - Autocomplete suggestions
 * - Mobile-responsive
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Search, UserPlus, AlertTriangle, Phone, Mail, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export interface Contact {
  id: number;
  name: string;
  phone: string;
  phoneE164?: string;
  email?: string;
  company?: string;
  roleTags?: string[];
  smsOptOut?: boolean;
}

interface ContactPickerProps {
  value?: Contact | null;
  onChange: (contact: Contact | null) => void;
  placeholder?: string;
  suggestedRoles?: string[];
  disabled?: boolean;
  className?: string;
}

export function ContactPicker({
  value,
  onChange,
  placeholder = "Search or create contact...",
  suggestedRoles = [],
  disabled = false,
  className,
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
  });
  const [duplicateWarnings, setDuplicateWarnings] = useState<Contact[]>([]);
  const { toast } = useToast();

  // Search contacts
  const { data: searchResults, isLoading: isSearching } = useQuery<{ contacts?: Contact[] }>({
    queryKey: ['/api/contacts/search', searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/contacts/search?query=${encodeURIComponent(searchQuery)}&limit=10`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: searchQuery.length >= 2 && open,
  });

  // Create contact mutation
  const createContact = useMutation({
    mutationFn: async (data: typeof newContact) => {
      const response = await apiRequest('POST', '/api/contacts/upsert', {
        ...data,
        roleTags: suggestedRoles,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        onChange(data.contact);
        setShowCreateDialog(false);
        setNewContact({ name: "", phone: "", email: "", company: "" });
        setDuplicateWarnings([]);
        queryClient.invalidateQueries({ queryKey: ['/api/contacts/search'], exact: false });
        toast({
          title: "Contact created",
          description: data.isNew ? "New contact added successfully" : "Contact updated",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error creating contact",
        description: error.message || "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  // Check for duplicates when creating new contact
  const checkDuplicates = useMutation({
    mutationFn: async (data: typeof newContact) => {
      const response = await apiRequest('POST', '/api/contacts/find-duplicates', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success && data.duplicates && data.duplicates.length > 0) {
        setDuplicateWarnings(data.duplicates);
      } else {
        setDuplicateWarnings([]);
      }
    },
  });

  // Auto-check for duplicates when user types
  useEffect(() => {
    if (newContact.phone.length >= 10 || (newContact.email && newContact.email.includes('@'))) {
      const timer = setTimeout(() => {
        checkDuplicates.mutate(newContact);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [newContact.phone, newContact.email]);

  const handleSelectContact = (contact: Contact) => {
    onChange(contact);
    setOpen(false);
  };

  const handleCreateNew = () => {
    setShowCreateDialog(true);
    setOpen(false);
  };

  const handleSubmitCreate = (ignoreDuplicates = false) => {
    if (!newContact.name || !newContact.phone) {
      toast({
        title: "Missing required fields",
        description: "Name and phone are required",
        variant: "destructive",
      });
      return;
    }

    // If duplicates exist and user hasn't acknowledged, show warning
    if (duplicateWarnings.length > 0 && !ignoreDuplicates) {
      toast({
        title: "Possible duplicates found",
        description: "Please review the warnings below",
        variant: "destructive",
      });
      return;
    }

    createContact.mutate(newContact);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between", className)}
            data-testid="button-contact-picker"
          >
            {value ? (
              <div className="flex items-center gap-2 truncate">
                <span className="font-medium truncate">{value.name}</span>
                {value.company && (
                  <span className="text-xs text-muted-foreground truncate">({value.company})</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type to search..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              data-testid="input-contact-search"
            />
            <CommandList>
              {isSearching && <CommandEmpty>Searching...</CommandEmpty>}
              {!isSearching && searchQuery.length < 2 && (
                <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
              )}
              {!isSearching && searchQuery.length >= 2 && searchResults?.contacts?.length === 0 && (
                <CommandEmpty>
                  No contacts found
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={handleCreateNew}
                    data-testid="button-create-new-contact"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create new contact
                  </Button>
                </CommandEmpty>
              )}
              {searchResults?.contacts && searchResults.contacts.length > 0 && (
                <CommandGroup heading="Contacts">
                  {searchResults.contacts.map((contact: Contact) => (
                    <CommandItem
                      key={contact.id}
                      value={contact.id.toString()}
                      onSelect={() => handleSelectContact(contact)}
                      data-testid={`item-contact-${contact.id}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value?.id === contact.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{contact.name}</span>
                          {contact.smsOptOut && (
                            <Badge variant="destructive" className="text-xs">No SMS</Badge>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{contact.phone}</span>
                          </div>
                          {contact.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                          {contact.company && (
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              <span className="truncate">{contact.company}</span>
                            </div>
                          )}
                        </div>
                        {contact.roleTags && contact.roleTags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {contact.roleTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {searchQuery.length >= 2 && (
                <CommandGroup>
                  <CommandItem onSelect={handleCreateNew} data-testid="button-create-contact-from-search">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create new contact
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Contact Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to the system. We'll check for duplicates automatically.
            </DialogDescription>
          </DialogHeader>

          {duplicateWarnings.length > 0 && (
            <Alert variant="destructive" data-testid="alert-duplicate-warnings">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Possible duplicates found:</p>
                <div className="space-y-2">
                  {duplicateWarnings.map((dup) => (
                    <div key={dup.id} className="text-sm bg-background p-2 rounded">
                      <div className="font-medium">{dup.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {dup.phone} {dup.email && `• ${dup.email}`}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-xs"
                        onClick={() => {
                          handleSelectContact(dup);
                          setShowCreateDialog(false);
                        }}
                        data-testid={`button-use-duplicate-${dup.id}`}
                      >
                        Use this contact instead
                      </Button>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="John Doe"
                data-testid="input-contact-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="(918) 555-1234"
                data-testid="input-contact-phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="john@example.com"
                data-testid="input-contact-email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={newContact.company}
                onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                placeholder="Acme Corp"
                data-testid="input-contact-company"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setDuplicateWarnings([]);
              }}
              data-testid="button-cancel-create-contact"
            >
              Cancel
            </Button>
            {duplicateWarnings.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => handleSubmitCreate(true)}
                disabled={createContact.isPending}
                data-testid="button-create-anyway"
              >
                Create Anyway
              </Button>
            )}
            <Button
              onClick={() => handleSubmitCreate(false)}
              disabled={createContact.isPending}
              data-testid="button-create-contact"
            >
              {createContact.isPending ? "Creating..." : "Create Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
