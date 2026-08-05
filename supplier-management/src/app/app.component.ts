import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationError } from '@angular/router';
import { AuthService } from './services/auth.service';
import { MobileService } from './services/mobile.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    template: '<router-outlet/>'
})
export class AppComponent implements OnInit {
  private router  = inject(Router);
  private auth    = inject(AuthService);
  private mobile  = inject(MobileService);

  ngOnInit() {
    // Never let native bootstrap failures surface as an unhandled rejection —
    // the app is fully usable on web and degrades gracefully without them.
    this.mobile.init().catch(err => console.error('[Mobile] init failed:', err));

    this.router.events.subscribe(event => {
      if (event instanceof NavigationError) {
        console.error('[Router] NavigationError:', event.error, 'URL:', event.url);
        if (!this.auth.isAuthenticated()) {
          this.router.navigate(['/login']);
        }
      }
    });
  }
}
