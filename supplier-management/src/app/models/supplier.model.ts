export interface Supplier {
  id: number;
  name: string;
  code: string;
  email: string;
  phone: string;
  category: SupplierCategory;
  status: SupplierStatus;
  country: string;
  city: string;
  address: string;
  website?: string;
  taxId: string;
  contactPerson: string;
  rating: number;
  totalOrders: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  tags: string[];
}

export type SupplierCategory =
  | 'technology'
  | 'manufacturing'
  | 'logistics'
  | 'services'
  | 'raw-materials'
  | 'food-beverage'
  | 'healthcare'
  | 'construction';

export type SupplierStatus = 'active' | 'inactive' | 'pending' | 'blacklisted';

export interface SupplierStats {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  blacklisted: number;
  totalSpent: number;
  avgRating: number;
}

export interface SupplierFilter {
  search: string;
  category: string;
  status: string;
  country: string;
  minRating: number;
}
