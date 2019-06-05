import { Component} from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { LoginAccessPage } from '../login-access/login-access';
import { Storage } from '@ionic/storage';
import { GenerateCodeProvider } from '../../providers/generate-code/generate-code';

@IonicPage()
@Component({
  selector: 'page-login-check',
  templateUrl: 'login-check.html',
})
export class LoginCheckPage {

  nPhone : string;
  responseVerification: any={};
  lista: any=[];
  verificationCode : string;

  constructor(public navCtrl: NavController, public navParams: 
    NavParams,private storage: Storage,
    public generateCodeProvider: GenerateCodeProvider) {
    
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad LoginCheckPage');
  }

  btnCheck(){
    console.log("NUMERO DE TELF "+ this.nPhone);
    if (this.isValid(this.nPhone)) {
      console.log("******ENTRANDO AL REDIRECT DEL LoginAccessPage ******** ");
      this.generateCodeProvider.createVerificationCode(this.nPhone)
      .then(data => {      
        this.responseVerification = data;
        console.log("data generateCodeProvider: " + data["message"]);
        console.log(JSON.stringify(data))
        console.log("genericCode: " + data["genericCode"])
        this.verificationCode = data["genericCode"];
        this.storage.set('genericCode', this.verificationCode);
        this.navCtrl.push(LoginAccessPage,{
          numberPhone: this.nPhone
        });
      })

    }
   
  }

   isValid(phoneNumber : string) : boolean {
    var valid  : boolean = true;
    if (phoneNumber == '' || phoneNumber == null) {
      return valid = false;
    }
     return valid;
  }


}
