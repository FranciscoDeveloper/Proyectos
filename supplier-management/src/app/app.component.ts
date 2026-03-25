import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationError, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet/>'
})
export class AppComponent implements OnInit {
  private router = inject(Router);

  ngOnInit() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationError) {
        console.error('[Router] NavigationError:', event.error, 'URL:', event.url);
        // If navigation fails (e.g. lazy chunk 404), redirect to login
        this.router.navigate(['/login']);
      }
    });
  }
}
