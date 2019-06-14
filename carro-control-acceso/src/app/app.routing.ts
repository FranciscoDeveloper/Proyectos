import { Routes, RouterModule } from '@angular/router';

import { HomeComponent } from './home';
import { LoginComponent } from './login';
import { RegisterComponent } from './register';
import { AuthGuard } from './_guards';
import { SolarSystemComponent } from './solar-system/solar-system.component'
import { ShoppingcartComponent } from './shoppingcart/shoppingcart.component';
const appRoutes: Routes = [
    { path: '', component: HomeComponent, canActivate: [AuthGuard] },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'shoppingcart', component: ShoppingcartComponent, canActivate: [AuthGuard] },
    { path: 'solarsystem', component: SolarSystemComponent },
    // otherwise redirect to home
    { path: '**', redirectTo: '' }
];

export const routing = RouterModule.forRoot(appRoutes);
