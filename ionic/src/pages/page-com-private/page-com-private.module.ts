import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import {PageComPrivatePage} from './page-com-private';


@NgModule({
  declarations: [
    PageComPrivatePage,
  ],
  imports: [
    IonicPageModule.forChild(PageComPrivatePage),
  ],
})
export class PageComPrivatePageModule {}
