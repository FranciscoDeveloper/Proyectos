import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

// dairi-book (VPC-attached, no NAT Gateway/internet route) can't reach Flow.cl to check
// payment status, so /api/book/payment/status always fails from there. dairi-payment is
// not VPC-attached and already talks to Flow for payment/create — status checks go
// through its function URL instead (read-only call to Flow, no charge/email side effects).
const PAYMENT_LAMBDA_URL = 'https://koxzbg6zrjrlfvx2j2kqrlokv40jkzzp.lambda-url.us-east-1.on.aws/';

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
    this.http.post<PaymentStatusResponse>(PAYMENT_LAMBDA_URL, { action: 'status', token }).subscribe({
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
