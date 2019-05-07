import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoadingController, AlertController } from 'ionic-angular';
import { API_CONFIG } from "../../config/api.js";




/*
  Generated class for the GenerateCodeProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class GenerateCodeProvider {

  errorCod: any;

  constructor(public httpClient: HttpClient,
    public loadingController: LoadingController,
    public alertController: AlertController) {
    console.log('Hello GenerateCodeProvider Provider');
  }

  createVerificationCode(phoneNumber: string) {
    let showLoadind = this.loadingController.create({
      content: "Cargando datos"
    })
    showLoadind.present();
    return new Promise(resolve => {
      console.log("BASE URL createVerificationCode " + `${API_CONFIG.baseAPI}${API_CONFIG.authenticator}`);
      this.httpClient.
        get(`${API_CONFIG.baseAPI}${API_CONFIG.authenticator}/createVerificationCode/` + phoneNumber + `/ESMERO`).subscribe(data => {
          resolve(data);
          showLoadind.dismiss();
        },
          err => {
            console.log(err);
            this.errorCod = err["error"]["code"]
            this.presentAlert(this.errorCod);
            showLoadind.dismiss();
          });
    });
  }

  async presentAlert(code: any) {
    var alert: any;

    switch (code) {
      case 401:
        alert = await this.alertController.create({
          message: 'Número no se encuentra registrado.',
          buttons: ['OK']
        });
        await alert.present();
        break;

      default:
        alert = await this.alertController.create({
          message: 'Lo sentimos estamos teniendo problemas de conexión.',
          buttons: ['OK']
        });
        await alert.present();
        break;
    }

  }

}
