import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { ListFacturasPage } from './list-facturas';

@NgModule({
  declarations: [
    ListFacturasPage,
  ],
  imports: [
    IonicPageModule.forChild(ListFacturasPage),
  ],
})
export class ListFacturasPageModule {}
