import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface SubscriptionPlan {
  id: number;
  code: string;
  label: string;
  biometricAuth: boolean;
  maxUsers: number;
}

export interface Subscription {
  id: number;
  name: string;
  planId: number;
  planCode: string;
  planLabel: string;
  biometricAuth: boolean | null;
  effectiveBiometricAuth: boolean;
  active: boolean;
  contactEmail: string;
  userCount: number;
  createdAt: string;
}

export interface SubscriptionUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface CreateSubscriptionDto {
  name: string;
  planCode: string;
  biometricAuth?: boolean | null;
  active?: boolean;
  contactEmail?: string;
}

export interface UpdateSubscriptionDto {
  name?: string;
  planCode?: string;
  biometricAuth?: boolean | null;
  active?: boolean;
  contactEmail?: string;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private http = inject(HttpClient);

  listPlans(): Promise<SubscriptionPlan[]> {
    return firstValueFrom(this.http.get<SubscriptionPlan[]>('/api/vendor/plans'));
  }

  listSubscriptions(): Promise<Subscription[]> {
    return firstValueFrom(this.http.get<Subscription[]>('/api/vendor/subscriptions'));
  }

  getSubscription(id: number): Promise<Subscription> {
    return firstValueFrom(this.http.get<Subscription>(`/api/vendor/subscriptions/${id}`));
  }

  createSubscription(dto: CreateSubscriptionDto): Promise<Subscription> {
    return firstValueFrom(this.http.post<Subscription>('/api/vendor/subscriptions', dto));
  }

  updateSubscription(id: number, dto: UpdateSubscriptionDto): Promise<Subscription> {
    return firstValueFrom(this.http.put<Subscription>(`/api/vendor/subscriptions/${id}`, dto));
  }

  deleteSubscription(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/vendor/subscriptions/${id}`));
  }

  listUsers(subscriptionId: number): Promise<SubscriptionUser[]> {
    return firstValueFrom(this.http.get<SubscriptionUser[]>(`/api/vendor/subscriptions/${subscriptionId}/users`));
  }
}
