import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { ViewChild } from '@angular/core';
import { Slides } from 'ionic-angular';
import { PlansProvider } from "../../providers/plans/plans";
import { RegisterPage } from "../register/register";
import { AlertController } from 'ionic-angular';
import { ConverthtmlPipe } from "../../pipes/convert-html/convert-html";
/**
 * Generated class for the PublicIndividualPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-public-individual',
  templateUrl: 'public-individual.html',
})
export class PublicIndividualPage {
  @ViewChild(Slides) slides: Slides;

  uso:any;
  plan:any;

  private plans:any;
  private alertCtrl:AlertController;
  constructor(public navCtrl: NavController, public navParams: NavParams,plansProvider:PlansProvider,alertCtrl:AlertController) {
    plansProvider.isDeveloper("sfsdf");
    console.log("este es el tipo "+ navParams.get('type'));
   this.alertCtrl=alertCtrl;

   this.uso = navParams.get('uso');
   this.plan = navParams.get('plan');
   
    plansProvider.getTariffPlanList(this.uso,this.plan).then(data => {
      this.plans=data;
    }) ;

  }

  btnRegister(){
    this.navCtrl.push(RegisterPage,{});
   }


   showAlertMas() {
    const alert = this.alertCtrl.create({
      title: 'Condiciones y terminos legales!',
      subTitle: 'Your friend, Obi wan Kenobi, just accepted your friend request!',
      buttons: ['OK']
    });
    alert.present();
  }

  
}