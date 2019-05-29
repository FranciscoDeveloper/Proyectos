import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { TabsPage } from '../tabs/tabs';
import { Storage } from '@ionic/storage';
import { LoginProvider } from '../../providers/login/login';

@IonicPage()
@Component({
  selector: 'page-login-access',
  templateUrl: 'login-access.html',
})
export class LoginAccessPage {

  cod1: string;
  cod2: string;
  cod3: string;
  cod4: string;
  responseLogin: any = {};
  nPhone: string;

  constructor(private storage: Storage, public navCtrl: NavController,
    public navParams: NavParams,
    public loginProvider: LoginProvider) {
    this.getCode();
    this.nPhone = navParams.get('numberPhone');
    console.log("NUMERO DE TELEFONO RECIBIDO " + this.nPhone);
  }

  loginPromise : any;

  ionViewDidLoad() {
    console.log('ionViewDidLoad LoginAccessPage');
  }

  getCode() {
    this.storage.get('genericCode').then((val) => {
      console.log('Your genericCode', val);
    })
  }


  btnAccess() {
    try {
      var verificatorCode = this.verificatorDigit(this.cod1, this.cod2, this.cod3, this.cod4);
      console.log("TELEFONO A ENVIAR********* " + this.nPhone);
      console.log("CODIGO VERIFICADOR " + verificatorCode);
      this.loginProvider.login(this.nPhone, verificatorCode)

        .then(data => {
          console.log("Ver data: " + data);
          console.log("typeof data: " + typeof data);
          this.responseLogin = data;
          console.log("*****************LOGIN***********");
          console.log("data loginProvider: " + data["message"]);
          console.log(JSON.stringify(data))
          console.log("authcToken: " + data["authcToken"])
          this.responseLogin = data["authcToken"];
          this.storage.set('authcToken', this.responseLogin);
          this.storage.set('numberPhone', this.nPhone);
          this.navCtrl.push(TabsPage, {});
          
        })

    } catch (error) {
      console.log(error);
    }

  }

  verificatorDigit(cod1: string, cod2: string, cod3: string, cod4: string): string {
    var verificatorCode: string;
    try {
      verificatorCode = cod1 + cod2 + cod3 + cod4;
    } catch (error) {
      console.log(error);
    }
    return verificatorCode;
  }


}




