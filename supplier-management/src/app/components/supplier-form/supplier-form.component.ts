import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, TitleCasePipe, DecimalPipe } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupplierService } from '../../services/supplier.service';
import { SupplierCategory, SupplierStatus } from '../../models/supplier.model';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TitleCasePipe, DecimalPipe],
  templateUrl: './supplier-form.component.html',
  styleUrl: './supplier-form.component.scss'
})
export class SupplierFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supplierService = inject(SupplierService);

  isEdit = signal(false);
  supplierId = signal<number | null>(null);
  saving = signal(false);
  saved = signal(false);

  categories: SupplierCategory[] = ['technology', 'manufacturing', 'logistics', 'services', 'raw-materials', 'food-beverage', 'healthcare', 'construction'];
  statuses: SupplierStatus[] = ['active', 'inactive', 'pending', 'blacklisted'];

  countries = [
    'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany',
    'India', 'Italy', 'Japan', 'Mexico', 'Netherlands', 'Singapore',
    'South Korea', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom', 'United States'
  ];

  form!: FormGroup;

  ngOnInit() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      code: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}-\d{3,}$/)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      category: ['', Validators.required],
      status: ['active', Validators.required],
      country: ['', Validators.required],
      city: ['', Validators.required],
      address: ['', Validators.required],
      website: [''],
      taxId: ['', Validators.required],
      contactPerson: ['', Validators.required],
      rating: [4.0, [Validators.required, Validators.min(1), Validators.max(5)]],
      totalOrders: [0, [Validators.required, Validators.min(0)]],
      totalSpent: [0, [Validators.required, Validators.min(0)]],
      notes: [''],
      tags: ['']
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.supplierId.set(+id);
      const supplier = this.supplierService.getById(+id);
      if (supplier) {
        this.form.patchValue({
          ...supplier,
          tags: supplier.tags.join(', ')
        });
      }
    }
  }

  get f() { return this.form.controls; }

  isInvalid(field: string) {
    const ctrl = this.form.get(field);
    return ctrl?.invalid && ctrl?.touched;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    const raw = this.form.getRawValue();
    const tags = raw.tags ? raw.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    const data = { ...raw, tags };

    setTimeout(() => {
      if (this.isEdit() && this.supplierId() !== null) {
        this.supplierService.update(this.supplierId()!, data);
      } else {
        this.supplierService.create(data);
      }
      this.saving.set(false);
      this.saved.set(true);
      setTimeout(() => this.router.navigate(['/suppliers']), 1000);
    }, 600);
  }

  cancel() {
    this.router.navigate(['/suppliers']);
  }

  getRatingStars(): boolean[] {
    const rating = this.form.get('rating')?.value ?? 0;
    return Array(5).fill(0).map((_, i) => i < Math.round(rating));
  }
}
