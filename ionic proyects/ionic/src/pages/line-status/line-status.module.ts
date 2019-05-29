import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { LineStatusPage } from './line-status';

@NgModule({
  declarations: [
    LineStatusPage,
  ],
  imports: [
    IonicPageModule.forChild(LineStatusPage),
  ],
})
export class LineStatusPageModule {}
