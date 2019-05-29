import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoadingController, Platform } from 'ionic-angular';
import { API_CONFIG } from "../../config/api.js";
import { HTTP } from '@ionic-native/http';
/*
  Generated class for the LoginProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class LoginProvider {

  constructor(public httpClient: HttpClient,
    public loadingController: LoadingController,
    private http: HTTP, public platform: Platform) {
    console.log('Hello LoginProvider Provider');
  }


  login(phoneNumber: string, code: string) {
    let developerMode = `${API_CONFIG.enviroment}`;
    let Loginresponse: any;
    let showLoadind = this.loadingController.create({
      content: "Cargando datos"
    })
    showLoadind.present();

    if (this.isDeveloper(developerMode)) {
      console.log("MODE DEVELOPER");
      return new Promise(resolve => {
        console.log("BASE URL Login " + `${API_CONFIG.baseAPI}${API_CONFIG.authenticator}`);
        this.httpClient.
          get(`${API_CONFIG.baseAPI}${API_CONFIG.authenticator}/login/` + phoneNumber + `/`, {
            headers: { 'code': code }
          }).subscribe(data => {
            resolve(data);
            showLoadind.dismiss();
          },
          err => {
            console.log("* Error Login() *")
            console.log(err);
            showLoadind.dismiss();
          });
      });
    } else {
      console.log("MODE PRODUCTION");
      return this.platform.ready().then(() => {
        showLoadind.dismiss();
        return this.http.get(`${API_CONFIG.baseAPI}${API_CONFIG.authenticator}/login/` + phoneNumber + `/`,{}, { 'code': code })        
      });
    }


  }

  isDeveloper(mode: string): boolean {
    var isDev: boolean = false;
    if (mode == 'dev') {
      return isDev = true;
    }
    return isDev;
  }

}
