import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { PersonalInformationProvider } from '../../providers/personal-information/personal-information';



@IonicPage()
@Component({
  selector: 'page-personal-information',
  templateUrl: 'personal-information.html',
})
export class PersonalInformationPage {

  personalInfo: any={};

  constructor(
    public navCtrl: NavController, 
    public navParams: NavParams,
    public personalInformationProvider:PersonalInformationProvider) {

    this.getPersonalInformation();
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad PersonalInformationPage');
  }

  getPersonalInformation() {
   
    this.personalInformationProvider.getPersonalInformation()
      .then(data => {      
        this.personalInfo = data;
        console.log("data: " + data["message"]);
        console.log(JSON.stringify(data))
      })
      .catch(err => {    
        console.error( 'función enRechazo invocada: ', err );
      });
  }

}
