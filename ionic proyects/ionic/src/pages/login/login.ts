import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, MenuController } from 'ionic-angular';
import { LoginCheckPage } from '../login-check/login-check';
import { RegisterPage } from '../register/register';
import { TabsPage } from '../tabs/tabs';
import { Storage } from '@ionic/storage';
import {PublicPlansPage  } from "../public-plans/public-plans";

@IonicPage()
@Component({
  selector: 'page-login',
  templateUrl: 'login.html',
})
export class LoginPage {

  constructor(public navCtrl: NavController, 
    public navParams: NavParams,
    private storage : Storage,
    private menuCtrl: MenuController) {
    this.verifyStorage();
    //this.menuCtrl.enable(false);
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad LoginPage');
  }


  btnRediret(){
    console.log("Entrando btn redirect Login")
    this.navCtrl.push(LoginCheckPage,{});
  }

  btnRegister(){
    this.navCtrl.push(RegisterPage,{});
  }
  
  btnPublicPlans(){
    this.navCtrl.push(PublicPlansPage,{});
  }

  verifyStorage(){
    this.storage.get('authcToken').then((val) => {
      if (val == '' || val == null) {
        return;
      }
      this.navCtrl.push(TabsPage,{});
      console.log('Your genericCode', val);
    })
  }

  
}
