import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { AlertController } from 'ionic-angular';

/**
 * Generated class for the PageAppPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-page-app',
  templateUrl: 'page-app.html',
})
export class PageAppPage {

  constructor(public navCtrl: NavController, public navParams: NavParams, public alertCtrl: AlertController) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad PageAppPage');
  }

  showAlertApp() {
    const alert = this.alertCtrl.create({
      title: 'Seleccione una opción!',
      buttons: ['Instalar','Configurar']
    });
    alert.present();
  }

}
