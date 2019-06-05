import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { PersonalAddressPage } from './personal-address';

@NgModule({
  declarations: [
    PersonalAddressPage,
  ],
  imports: [
    IonicPageModule.forChild(PersonalAddressPage),
  ],
})
export class PersonalAddressPageModule {}
