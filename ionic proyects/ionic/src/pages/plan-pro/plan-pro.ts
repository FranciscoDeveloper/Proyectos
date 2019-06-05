import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { TabsPage } from '../tabs/tabs';

@IonicPage()
@Component({
  selector: 'page-plan-pro',
  templateUrl: 'plan-pro.html',
})
export class PlanProPage {

  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad PlanProPage');
  }
  
  btnBegin(){ 
    this.navCtrl.setRoot(TabsPage);
  }

}
