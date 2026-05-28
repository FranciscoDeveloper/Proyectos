import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type ActivateState = 'checking' | 'success' | 'error';

@Component({
  selector: 'app-activate',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './activate.component.html',
  styleUrl: './activate.component.scss'
})
export class ActivateComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http  = inject(HttpClient);

  state   = signal<ActivateState>('checking');
  message = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.message.set('Enlace de activación inválido o incompleto.');
      this.state.set('error');
      return;
    }
    this.http.post<{ message: string }>('/api/auth/activate', { token }).subscribe({
      next: (res) => {
        this.message.set(res.message ?? '¡Cuenta activada! Ya puedes iniciar sesión.');
        this.state.set('success');
      },
      error: (err) => {
        this.message.set(
          err.error?.message ?? 'El enlace de activación es inválido o ha expirado.'
        );
        this.state.set('error');
      },
    });
  }
}
