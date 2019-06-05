import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Platform } from 'ionic-angular';
import { API_CONFIG } from "../../config/api.js";
import { HTTP } from '@ionic-native/http';
import { Storage } from '@ionic/storage';
/*
  Generated class for the CloseSessionProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class CloseSessionProvider {


  constructor(public httpClient: HttpClient,
    private http: HTTP,
    private storage: Storage,
    public platform: Platform, ) {
    console.log('Hello CloseSessionProvider Provider');
  }


  logOut(storageResponse) {
    let developerMode = `${API_CONFIG.enviroment}`;
    let phoneNumber = storageResponse[1];

    if (this.isDeveloper(developerMode)) {
      console.log("MODE DEVELOPER");
      return new Promise(resolve => {
        console.log("BASE URL Login " + `${API_CONFIG.baseAPI}${API_CONFIG.authenticator}`);
        this.httpClient.
          get(`${API_CONFIG.baseAPI}${API_CONFIG.authenticator}/logOut/` + phoneNumber + `/`, {
            headers: { 'token': storageResponse[0] }
          }).subscribe(data => {
            resolve(data);
          },
            err => {
              console.log("* Error Login() *")
              console.log(err);
            });
      });
    } else {
      console.log("MODE PRODUCTION");
      return this.platform.ready().then(() => {
        return this.http.get(`${API_CONFIG.baseAPI}${API_CONFIG.authenticator}/logOut/` + phoneNumber + `/`, {}, { 'token': storageResponse[0] })
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
