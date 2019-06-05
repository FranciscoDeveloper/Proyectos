import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { PublicIndividualPage } from './public-individual';

@NgModule({
  declarations: [
    PublicIndividualPage,
  ],
  imports: [
    IonicPageModule.forChild(PublicIndividualPage),
  ],
})
export class PublicIndividualPageModule {}
