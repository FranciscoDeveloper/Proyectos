import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { PlanProPage } from '../plan-pro/plan-pro';
import { PlanIlimitadoPage } from '../plan-ilimitado/plan-ilimitado';
import { PlanProUnidosPage } from '../plan-pro-unidos/plan-pro-unidos';
import { TabsPage } from '../tabs/tabs';

@IonicPage()
@Component({
  selector: 'page-plans',
  templateUrl: 'plans.html',
})
export class PlansPage {

  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad PlansPage');
  }

  btnBegin(){ 
    this.navCtrl.setRoot(TabsPage);
  }

  btnPlanPro(){
    this.navCtrl.push(PlanProPage,{});
  }

  btnPlanProUnidos(){
    this.navCtrl.push(PlanProUnidosPage,{});
  }

  btnPlanIlimitado(){
    this.navCtrl.push(PlanIlimitadoPage,{});
  }

}
