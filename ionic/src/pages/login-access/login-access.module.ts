import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { LoginAccessPage } from './login-access';

@NgModule({
  declarations: [
    LoginAccessPage,
  ],
  imports: [
    IonicPageModule.forChild(LoginAccessPage),
  ],
})
export class LoginAccessPageModule {}
