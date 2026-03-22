import { Injectable, signal } from '@angular/core';
import { Supplier, SupplierCategory, SupplierFilter, SupplierStats } from '../models/supplier.model';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private suppliers = signal<Supplier[]>(this.getMockData());

  getAll() {
    return this.suppliers;
  }

  getById(id: number): Supplier | undefined {
    return this.suppliers().find(s => s.id === id);
  }

  create(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Supplier {
    const newSupplier: Supplier = {
      ...supplier,
      id: Date.now(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.suppliers.update(list => [...list, newSupplier]);
    return newSupplier;
  }

  update(id: number, data: Partial<Supplier>): Supplier | null {
    let updated: Supplier | null = null;
    this.suppliers.update(list =>
      list.map(s => {
        if (s.id === id) {
          updated = { ...s, ...data, updatedAt: new Date() };
          return updated;
        }
        return s;
      })
    );
    return updated;
  }

  delete(id: number): void {
    this.suppliers.update(list => list.filter(s => s.id !== id));
  }

  getStats(): SupplierStats {
    const list = this.suppliers();
    return {
      total: list.length,
      active: list.filter(s => s.status === 'active').length,
      inactive: list.filter(s => s.status === 'inactive').length,
      pending: list.filter(s => s.status === 'pending').length,
      blacklisted: list.filter(s => s.status === 'blacklisted').length,
      totalSpent: list.reduce((acc, s) => acc + s.totalSpent, 0),
      avgRating: list.length ? list.reduce((acc, s) => acc + s.rating, 0) / list.length : 0
    };
  }

  filter(filters: SupplierFilter): Supplier[] {
    return this.suppliers().filter(s => {
      const matchSearch = !filters.search ||
        s.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.code.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.email.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.contactPerson.toLowerCase().includes(filters.search.toLowerCase());

      const matchCategory = !filters.category || s.category === filters.category;
      const matchStatus = !filters.status || s.status === filters.status;
      const matchCountry = !filters.country || s.country === filters.country;
      const matchRating = !filters.minRating || s.rating >= filters.minRating;

      return matchSearch && matchCategory && matchStatus && matchCountry && matchRating;
    });
  }

  private getMockData(): Supplier[] {
    return [
      {
        id: 1,
        name: 'TechCorp Solutions',
        code: 'TC-001',
        email: 'contact@techcorp.com',
        phone: '+1 (555) 234-5678',
        category: 'technology',
        status: 'active',
        country: 'United States',
        city: 'San Francisco',
        address: '123 Silicon Valley Blvd',
        website: 'https://techcorp.com',
        taxId: 'US-123456789',
        contactPerson: 'Alice Johnson',
        rating: 4.8,
        totalOrders: 245,
        totalSpent: 1250000,
        createdAt: new Date('2022-01-15'),
        updatedAt: new Date('2024-11-10'),
        tags: ['IT', 'cloud', 'enterprise'],
        notes: 'Premium technology partner. Fast delivery and excellent support.'
      },
      {
        id: 2,
        name: 'Global Logistics Co',
        code: 'GL-002',
        email: 'ops@globallogistics.com',
        phone: '+44 20 7946 0958',
        category: 'logistics',
        status: 'active',
        country: 'United Kingdom',
        city: 'London',
        address: '45 Freight Lane, EC1A 1BB',
        website: 'https://globallogistics.co.uk',
        taxId: 'GB-987654321',
        contactPerson: 'James Wilson',
        rating: 4.5,
        totalOrders: 512,
        totalSpent: 890000,
        createdAt: new Date('2021-06-20'),
        updatedAt: new Date('2024-12-01'),
        tags: ['shipping', 'warehousing', 'international'],
        notes: 'Reliable logistics partner with global reach.'
      },
      {
        id: 3,
        name: 'PrimeMaterials SA',
        code: 'PM-003',
        email: 'ventas@primematerials.es',
        phone: '+34 91 234 5678',
        category: 'raw-materials',
        status: 'active',
        country: 'Spain',
        city: 'Madrid',
        address: 'Av. Industria 78, 28001',
        taxId: 'ES-B12345678',
        contactPerson: 'Carlos Ruiz',
        rating: 4.2,
        totalOrders: 178,
        totalSpent: 650000,
        createdAt: new Date('2022-03-10'),
        updatedAt: new Date('2024-10-15'),
        tags: ['metals', 'polymers', 'certified'],
        notes: 'ISO 9001 certified raw materials supplier.'
      },
      {
        id: 4,
        name: 'FoodBev International',
        code: 'FB-004',
        email: 'supply@foodbev.int',
        phone: '+49 30 12345678',
        category: 'food-beverage',
        status: 'pending',
        country: 'Germany',
        city: 'Berlin',
        address: 'Industriestraße 55, 10115',
        website: 'https://foodbev.int',
        taxId: 'DE-234567890',
        contactPerson: 'Monika Braun',
        rating: 3.9,
        totalOrders: 45,
        totalSpent: 120000,
        createdAt: new Date('2024-08-01'),
        updatedAt: new Date('2024-12-10'),
        tags: ['organic', 'HACCP', 'EU-certified'],
        notes: 'New supplier under evaluation. Promising initial orders.'
      },
      {
        id: 5,
        name: 'BuildRight Construcción',
        code: 'BR-005',
        email: 'info@buildright.mx',
        phone: '+52 55 9876 5432',
        category: 'construction',
        status: 'inactive',
        country: 'Mexico',
        city: 'Mexico City',
        address: 'Blvd. Insurgentes 1200, CDMX',
        taxId: 'MX-RFC123456',
        contactPerson: 'Roberto Méndez',
        rating: 3.5,
        totalOrders: 32,
        totalSpent: 430000,
        createdAt: new Date('2020-11-05'),
        updatedAt: new Date('2024-07-20'),
        tags: ['construction', 'cement', 'steel'],
        notes: 'Contract paused. Renegotiating terms.'
      },
      {
        id: 6,
        name: 'HealthPlus Supplies',
        code: 'HP-006',
        email: 'procurement@healthplus.ca',
        phone: '+1 416 555 0199',
        category: 'healthcare',
        status: 'active',
        country: 'Canada',
        city: 'Toronto',
        address: '789 Medical Drive, ON M5H 2N2',
        website: 'https://healthplus.ca',
        taxId: 'CA-BN123456789',
        contactPerson: 'Sarah Mitchell',
        rating: 4.9,
        totalOrders: 390,
        totalSpent: 2100000,
        createdAt: new Date('2019-05-12'),
        updatedAt: new Date('2024-12-15'),
        tags: ['FDA-approved', 'medical', 'PPE'],
        notes: 'Top-rated healthcare supplier. Critical partnership.'
      },
      {
        id: 7,
        name: 'ManufacturePro Asia',
        code: 'MA-007',
        email: 'b2b@manufacturepro.cn',
        phone: '+86 21 5555 8888',
        category: 'manufacturing',
        status: 'blacklisted',
        country: 'China',
        city: 'Shanghai',
        address: '88 Factory Road, Pudong',
        taxId: 'CN-91310000MA1FL1A12',
        contactPerson: 'Wei Zhang',
        rating: 2.1,
        totalOrders: 12,
        totalSpent: 75000,
        createdAt: new Date('2023-02-28'),
        updatedAt: new Date('2024-09-05'),
        tags: ['components', 'electronics'],
        notes: 'BLACKLISTED: Repeated quality failures and delivery issues.'
      },
      {
        id: 8,
        name: 'ProServices Group',
        code: 'PS-008',
        email: 'hello@proservices.com.au',
        phone: '+61 2 9876 5432',
        category: 'services',
        status: 'active',
        country: 'Australia',
        city: 'Sydney',
        address: '321 Business Park, NSW 2000',
        website: 'https://proservices.com.au',
        taxId: 'AU-ABN12345678',
        contactPerson: 'Emma Thompson',
        rating: 4.6,
        totalOrders: 156,
        totalSpent: 540000,
        createdAt: new Date('2021-09-18'),
        updatedAt: new Date('2024-11-30'),
        tags: ['consulting', 'maintenance', 'SLA'],
        notes: 'Excellent SLA compliance. Preferred services vendor.'
      }
    ];
  }
}
