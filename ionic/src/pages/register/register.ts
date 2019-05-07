import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { LoginCheckPage } from '../login-check/login-check';
import { RegisterAddressPage } from '../register-address/register-address';

/**
 * Generated class for the RegisterPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-register',
  templateUrl: 'register.html',
})
export class RegisterPage {

  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad RegisterPage');
  }

  btnRediret(){
    this.navCtrl.push(LoginCheckPage,{});
  }

  btnRegisterAddress(){
    this.navCtrl.push(RegisterAddressPage,{});
  }

}
