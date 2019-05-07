import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Platform } from 'ionic-angular';
import { API_CONFIG } from "../../config/api.js";
import { HTTP } from '@ionic-native/http';
/*
  Generated class for the PlansProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class PlansProvider {

  constructor(
    public httpClient: HttpClient,
    public platform: Platform,
    private http: HTTP) {
    console.log('ConsumptionProvider Provider');
  }

  getTariffPlanList(tokenParam:string,typePlan:any) {

    let developerMode = `${API_CONFIG.enviroment}`;
    if (this.isDeveloper(developerMode)) {
      console.log(`MODE ${API_CONFIG.enviroment}`);
      return new Promise(resolve => {
        this.httpClient.post("http://192.168.119.84:19080/ServicesPlanListWS/api/planService/getTariffPlanList/", typePlan, {})
        .subscribe(data => {
            resolve(data);
        //  resolve(data.tariffPlanList);
         }, error => {
          console.log(error);
        });
      });
    }else {
      console.log(`MODE ${API_CONFIG.enviroment}`);
      return this.platform.ready().then(() => {
        return this.http.get(`${API_CONFIG.baseAPI}portal/getConsumptionsByTelephoneNumber/${API_CONFIG.operator}`,{}, { 'token':tokenParam })
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






