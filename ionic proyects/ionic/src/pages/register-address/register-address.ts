import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { LoginCheckPage } from '../login-check/login-check';
import { RegisterAddCodePage } from '../register-add-code/register-add-code';

/**
 * Generated class for the RegisterAddressPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-register-address',
  templateUrl: 'register-address.html',
})
export class RegisterAddressPage {

  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad RegisterAddressPage');
  }

  btnRediret(){
    this.navCtrl.push(LoginCheckPage,{});
  }

  btnAddCode(){
    this.navCtrl.push(RegisterAddCodePage,{});
  }

  

}
