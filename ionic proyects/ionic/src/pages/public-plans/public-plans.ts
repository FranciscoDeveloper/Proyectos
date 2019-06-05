import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { PublicPlanProPage } from "../public-plan-pro/public-plan-pro";
import { PublicPlanIlimitadoPage } from "../public-plan-ilimitado/public-plan-ilimitado";
import { PublicPlanProUnidosPage } from "../public-plan-pro-unidos/public-plan-pro-unidos";
import { TabsPage } from '../tabs/tabs';
/**
 * Generated class for the PublicPlansPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-PublicPlans',
  templateUrl: 'public-plans.html',
})
export class PublicPlansPage {

  constructor(public navCtrl: NavController, public navParams: NavParams) {
   
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad PlansPage');
  }

  btnBegin(){ 
    this.navCtrl.setRoot(TabsPage);
  }

  btnPlanPro(){
   this.navCtrl.push(PublicPlanProPage,{});
  }

  btnPlanProUnidos(){
    this.navCtrl.push(PublicPlanProUnidosPage,{});
  }

  btnPlanIlimitado(){
    this.navCtrl.push(PublicPlanIlimitadoPage,{});
  }

}
