export interface VehicleCard {
  id: number;
  customerId: number;
  year: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  createdAt?: string;
  updatedAt?: string;
}
