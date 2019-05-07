import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { LoginCheckPage } from './login-check';

@NgModule({
  declarations: [
    LoginCheckPage,
  ],
  imports: [
    IonicPageModule.forChild(LoginCheckPage),
  ],
})
export class LoginCheckPageModule {}
