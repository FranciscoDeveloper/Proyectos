import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { PageAppPage } from './page-app';

@NgModule({
  declarations: [
    PageAppPage,
  ],
  imports: [
    IonicPageModule.forChild(PageAppPage),
  ],
})
export class PageAppPageModule {}
