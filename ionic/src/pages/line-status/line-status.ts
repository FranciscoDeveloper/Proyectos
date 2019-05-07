import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { TabsPage } from '../tabs/tabs';

@IonicPage()
@Component({
  selector: 'page-line-status',
  templateUrl: 'line-status.html',
})
export class LineStatusPage {

  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad LineStatusPage');
  }

  btnBegin(){
    this.navCtrl.setRoot(TabsPage);
  }

}
