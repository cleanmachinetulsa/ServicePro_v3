/**
 * Google Places API interfaces for address autocomplete
 */

export interface AddressSuggestion {
  description: string;
  placeId: string;
}

export interface AddressDetails {
  address: string;
  lat: number | null;
  lng: number | null;
  formatted: string;
}
