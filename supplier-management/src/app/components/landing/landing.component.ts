import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-landing',
    imports: [RouterLink],
    templateUrl: './landing.component.html',
    styleUrl: './landing.component.scss',
    encapsulation: ViewEncapsulation.None
})
export class LandingComponent {}
