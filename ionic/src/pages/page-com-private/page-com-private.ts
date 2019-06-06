import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, LoadingController } from 'ionic-angular';
import { TabsPage } from '../tabs/tabs';
import { Slides } from 'ionic-angular';
import { ViewChild } from '@angular/core';
import { AlertController } from 'ionic-angular';
import { PlansPrivateProvider } from '../../providers/plans-private/plans-private';
import { RegisterPage } from '../register/register';
import {ConverthtmlPipe} from '../../pipes/convert-html/convert-html';
import { API_CONFIG } from "../../config/api.js";

/**
 * Generated class for the PageComPrivatePage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-page-com-private',
  templateUrl: 'page-com-private.html',
})
export class PageComPrivatePage {

  consumption: any={};
  lista:any=[];
  uso:any;
  plan:any;
 

  constructor(public navCtrl: NavController, 
    public plansPrivateProvider: PlansPrivateProvider,
    public navParams: NavParams, 
    public alertCtrl: AlertController,
    public loadingController:LoadingController) {
      console.log("Entre")
      this.uso = navParams.get('uso');
      this.plan = navParams.get('plan');
      this.getDatos(this.uso,this.plan);

  }
  @ViewChild(Slides) slides: Slides;

  ionViewDidLoad() {
    console.log('ionViewDidLoad PageComPrivatePage');
  }

  btnBegin(){ 
    this.navCtrl.setRoot(TabsPage);
  }
  goToSlide() {
    this.slides.slideTo(2, 1000);
  }

  showAlertMas() {
    const alert = this.alertCtrl.create({
      title: 'Condiciones y terminos legales!',
      subTitle: 'Your friend, Obi wan Kenobi, just accepted your friend request!',
      buttons: ['OK']
    });
    alert.present();
  }
  

  getDatos(uso:number,plan:string) {
    let showLoadind = this.loadingController.create({
      content: "Cargando datos"
    })

    showLoadind.present();
    this.plansPrivateProvider.getConsumption(uso,plan)
      .then(data => {      
        this.consumption = data;       
        // console.log(`code: ${data['code']}    `)
        // console.log(`data: ${data["message"]} `)
        // console.log(JSON.stringify(data))
        console.log("visualConfigCommercialOfferListDTO:" + data["visualConfigCommercialOfferListDTO"])
        console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++");
        // console.log(data["visualConfigCommercialOfferListDTO"][0]["descriptionService"])
        console.log(data["visualConfigCommercialOfferListDTO"])
        console.log(data["socialNetworksList"])
        this.lista=data["visualConfigCommercialOfferListDTO"];
        console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++");
        showLoadind.dismiss();
      })
      .catch(err => {
        console.error('Error getDatos(): ', err );
        showLoadind.dismiss();
      });
  }

  registerPage(){

    this.navCtrl.push(RegisterPage,{});
  }

}
