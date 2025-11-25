import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { AddressSuggestion, AddressDetails } from "@shared/places";

interface AddressAutocompleteProps {
  value?: string;
  onSelect: (details: AddressDetails) => void;
  label?: string;
  placeholder?: string;
  testId?: string;
}

export default function AddressAutocomplete({
  value,
  onSelect,
  label = "Address",
  placeholder = "Start typing an address...",
  testId = "input-address-autocomplete",
}: AddressAutocompleteProps) {
  const [input, setInput] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Update input when external value changes
  useEffect(() => {
    if (value !== undefined) {
      setInput(value);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const { data: suggestions = [] } = useQuery<AddressSuggestion[]>({
    queryKey: ["places-autocomplete", input],
    queryFn: async () => {
      if (!input || input.length < 3) return [];
      const r = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      const json = await r.json();
      return json.predictions?.map((p: any) => ({
        description: p.description,
        placeId: p.place_id,
      })) ?? [];
    },
    enabled: input.length >= 3,
    staleTime: 30000, // Cache for 30 seconds
  });

  async function handleSelect(item: AddressSuggestion) {
    setInput(item.description);
    setOpen(false);

    // Fetch place details to get lat/lng
    const r = await fetch(`/api/places/details?placeId=${item.placeId}`);
    const details = await r.json();

    onSelect({
      address: item.description,
      lat: details?.lat ?? null,
      lng: details?.lng ?? null,
      formatted: details?.formatted ?? item.description,
    });
  }

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <Label htmlFor={testId} className="text-xs">{label}</Label>
      <Input
        id={testId}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) {
            setOpen(true);
          }
        }}
        placeholder={placeholder}
        className="mt-1"
        data-testid={testId}
        autoComplete="off"
      />

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md w-full shadow-lg max-h-60 overflow-auto mt-1">
          {suggestions.map((item) => (
            <div
              key={item.placeId}
              className="px-3 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm"
              onClick={() => handleSelect(item)}
              data-testid={`suggestion-${item.placeId}`}
            >
              {item.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
