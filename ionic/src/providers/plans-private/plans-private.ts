import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Platform } from 'ionic-angular';
import { API_CONFIG } from "../../config/api.js";
import { HTTP } from '@ionic-native/http';


@Injectable()
export class PlansPrivateProvider {

  constructor(
    public httpClient: HttpClient,
    public platform: Platform,
    private http: HTTP) {
    console.log('plansPrivateProvider Provider');
  }

  getConsumption(uso:number,plan:string) {

    let developerMode = `${API_CONFIG.enviroment}`;
    if (this.isDeveloper(developerMode)) {
      console.log(`MODE ${API_CONFIG.enviroment}`);
      return new Promise(resolve => {
        this.httpClient.get(`${API_CONFIG.baseAPI}portal/getListCommercialOffertConfig/${uso}/${plan}/${API_CONFIG.idTerritorialDiv}/${API_CONFIG.idTerritorialDivLevel}/${API_CONFIG.operator}`).subscribe(data => {
          resolve(data);      
        }, 
        err => {
          console.log("* Error getConsumption() *")
          console.log(err);       
        });
      });
    }else {
      console.log(`MODE ${API_CONFIG.enviroment}`);
      return this.platform.ready().then(() => {
        return this.http.get(`${API_CONFIG.baseAPI}portal/getListCommercialOffertConfig/${uso}/${plan}/${API_CONFIG.idTerritorialDiv}/${API_CONFIG.idTerritorialDivLevel}/${API_CONFIG.operator}`,{}, {})
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
