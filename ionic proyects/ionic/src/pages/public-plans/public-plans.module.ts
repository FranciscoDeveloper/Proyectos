import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { PublicPlansPage } from './public-plans';

@NgModule({
  declarations: [
    PublicPlansPage,
  ],
  imports: [
    IonicPageModule.forChild(PublicPlansPage),
  ],
})
export class PublicPlansPageModule {}
