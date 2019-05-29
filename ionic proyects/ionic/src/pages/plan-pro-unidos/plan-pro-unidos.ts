import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { TabsPage } from '../tabs/tabs';

@IonicPage()
@Component({
  selector: 'page-plan-pro-unidos',
  templateUrl: 'plan-pro-unidos.html',
})
export class PlanProUnidosPage {

  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad PlanProUnidosPage');
  }

  btnBegin(){ 
    this.navCtrl.setRoot(TabsPage);
  }

}
