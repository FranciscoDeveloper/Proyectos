import { Component, computed, inject } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupplierService } from '../../services/supplier.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TitleCasePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private supplierService = inject(SupplierService);

  stats = computed(() => this.supplierService.getStats());
  recentSuppliers = computed(() =>
    this.supplierService.getAll()()
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
  );

  topSuppliers = computed(() =>
    this.supplierService.getAll()()
      .filter(s => s.status === 'active')
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 4)
  );

  statCards = computed(() => [
    { label: 'Total Suppliers', value: this.stats().total, icon: 'users', color: 'primary', change: '+12%', positive: true, isCurrency: false },
    { label: 'Active Suppliers', value: this.stats().active, icon: 'check-circle', color: 'success', change: '+5%', positive: true, isCurrency: false },
    { label: 'Pending Review', value: this.stats().pending, icon: 'clock', color: 'warning', change: '3 new', positive: false, isCurrency: false },
    { label: 'Total Spent', value: this.stats().totalSpent, icon: 'dollar', color: 'info', change: '+18%', positive: true, isCurrency: true }
  ]);

  formatCurrency(value: number): string {
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K';
    return '$' + value.toString();
  }

  getStars(rating: number): string[] {
    return Array(5).fill(0).map((_, i) => i < Math.floor(rating) ? 'full' : 'empty');
  }

  getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #3b82f6, #2563eb)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #ef4444, #dc2626)',
      'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      'linear-gradient(135deg, #06b6d4, #0891b2)',
      'linear-gradient(135deg, #ec4899, #db2777)',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }
}
