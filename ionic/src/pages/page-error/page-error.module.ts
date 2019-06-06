import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { PageErrorPage } from './page-error';

@NgModule({
  declarations: [
    PageErrorPage,
  ],
  imports: [
    IonicPageModule.forChild(PageErrorPage),
  ],
})
export class PageErrorPageModule {}
