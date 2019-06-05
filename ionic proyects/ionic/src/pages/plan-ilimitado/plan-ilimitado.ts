import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { TabsPage } from '../tabs/tabs';

@IonicPage()
@Component({
  selector: 'page-plan-ilimitado',
  templateUrl: 'plan-ilimitado.html',
})
export class PlanIlimitadoPage {

  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad PlanIlimitadoPage');
  }

  btnBegin(){ 
    this.navCtrl.setRoot(TabsPage);
  }


}
