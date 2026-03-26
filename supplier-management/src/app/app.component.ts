import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationError } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet/>'
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private auth   = inject(AuthService);

  ngOnInit() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationError) {
        console.error('[Router] NavigationError:', event.error, 'URL:', event.url);
        // Only redirect to /login when NOT authenticated.
        // If authenticated, redirecting to /login triggers guestGuard → /dashboard → loop.
        if (!this.auth.isAuthenticated()) {
          this.router.navigate(['/login']);
        }
      }
    });
  }
}
