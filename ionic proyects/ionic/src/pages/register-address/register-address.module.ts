import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { RegisterAddressPage } from './register-address';

@NgModule({
  declarations: [
    RegisterAddressPage,
  ],
  imports: [
    IonicPageModule.forChild(RegisterAddressPage),
  ],
})
export class RegisterAddressPageModule {}
