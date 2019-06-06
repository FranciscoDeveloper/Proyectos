import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { ListRecargasPage } from './list-recargas';

@NgModule({
  declarations: [
    ListRecargasPage,
  ],
  imports: [
    IonicPageModule.forChild(ListRecargasPage),
  ],
})
export class ListRecargasPageModule {}
