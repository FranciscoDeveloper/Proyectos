import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Platform } from 'ionic-angular';
import { API_CONFIG } from "../../config/api.js";
import { HTTP } from '@ionic-native/http';

/*
  Generated class for the RecargasProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class RecargasProvider {

  constructor(
    public httpClient: HttpClient,
    public platform: Platform,
    private http: HTTP) {
    console.log('PlansProvider Provider');
  }


  getBusinessDetailRechargeIdSubscriber(storageResponse) {
    console.log(`${API_CONFIG.baseAPI}portal/getBusinessDetailRechargeIdSubscriber/${storageResponse[1]}/${API_CONFIG.idBusinessType}`)
    console.log(storageResponse[0])
    let developerMode = `${API_CONFIG.enviroment}`;
    try {
      if (this.isDeveloper(developerMode)) {
        console.log(`MODE ${API_CONFIG.enviroment}`);
        return new Promise(resolve =>{
          return this.platform.ready().then(() => {
           // return this.httpClient.get(`${API_CONFIG.baseAPI}portal/getBusinessDetailRechargeIdSubscriber/${storageResponse[1]}/${API_CONFIG.idBusinessType}`, { 
              return this.httpClient.get(`${API_CONFIG.baseAPI}portal/getBusinessDetailRechargeIdSubscriber/${storageResponse[1]}/${API_CONFIG.idBusinessType}`, { 
              headers: { 'token': storageResponse[0] }
             }).subscribe(data =>{
              console.log(data);
             resolve(data['listBusinessManagementDetailDTO']);
            });
          });
        });
  
      }else {
    
        console.log("MODE PRODUCTION");
        return this.platform.ready().then(() => {    
          return this.http.get(`${API_CONFIG.baseAPI}portal/getBusinessDetailRechargeIdSubscriber/${storageResponse[1]}/${API_CONFIG.idBusinessType}`
          ,{},    { 'token': storageResponse[0] });      
        });
  
      }
    } catch (error) {
      console.log(error);
      return error;
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
