import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type PaymentStatus = 'pending' | 'paid' | 'rejected' | 'cancelled';

interface PaymentStatusResponse {
  status:        PaymentStatus;
  amount?:       number;
  currency?:     string;
  commerceOrder?: string;
  flowOrder?:    number;
}

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './payment-result.component.html',
  styleUrl: './payment-result.component.scss'
})
export class PaymentResultComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http  = inject(HttpClient);

  checking = signal(true);
  hasError = signal(false);
  status   = signal<PaymentStatusResponse | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.hasError.set(true);
      this.checking.set(false);
      return;
    }
    this.http.get<PaymentStatusResponse>(`/api/book/payment/status?token=${encodeURIComponent(token)}`).subscribe({
      next: res => {
        this.status.set(res);
        this.checking.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.checking.set(false);
      }
    });
  }
}
