import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Platform } from 'ionic-angular';
import { API_CONFIG } from "../../config/api.js";
import { HTTP } from '@ionic-native/http';

/*
  Generated class for the FacturasProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class FacturasProvider {


  private serviceUrl:string;
  constructor(
    public httpClient: HttpClient,
    public platform: Platform,
    private http: HTTP) {
    console.log('PlansProvider Provider');
  }


  summaryGetByIdAccount(storageResponse) {
  
    console.log(`${API_CONFIG.baseAPI}portal/summaryGetByIdAccount/${storageResponse[1]}`);
    console.log(storageResponse[0])
    let developerMode = `${API_CONFIG.enviroment}`;
    try {
      if (this.isDeveloper(developerMode)) {
        console.log(`MODE ${API_CONFIG.enviroment}`);
        return new Promise(resolve =>{
          return this.platform.ready().then(() => {
          //  return this.httpClient.get(`${API_CONFIG.baseAPI}portal/summaryGetByIdAccount${storageResponse[0]}`, { 
            return this.httpClient.get(`${API_CONFIG.baseAPI}portal/summaryGetByIdAccount/${storageResponse[1]}`, { 
              headers: { 'token': storageResponse[0] }
             }).subscribe(data =>{
              console.log(data["listClassDTO"]);
             resolve(data["listClassDTO"]);
            });
          });
        });
  
      }else {
        console.log("MODE PRODUCTION");
        return this.platform.ready().then(() => {    
          return this.http.get(`${API_CONFIG.baseAPI}portal/summaryGetByIdAccount${storageResponse[0]}`
          ,{},    { 'token': storageResponse[0] });      
        });
  
      } 
    } catch (error) {
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

  getPDF(){
    let developerMode = `${API_CONFIG.enviroment}`;
    if (this.isDeveloper(developerMode)) {
      console.log(`MODE ${API_CONFIG.enviroment}`);
      return new Promise(resolve =>{
        return this.platform.ready().then(() => {
        //  return this.httpClient.get(`${API_CONFIG.baseAPI}portal/summaryGetByIdAccount${storageResponse[0]}`, { 
          return this.httpClient.get(`localhost:8080/BillingDocumentWS/api/documentbill/create`, { 
            headers: {  }
           }).subscribe(data =>{
            console.log(data);
           resolve(data);
          });
        });
      });

    }else {
      console.log("MODE PRODUCTION");
      return this.platform.ready().then(() => {    
        return this.http.get(`localhost:8080/BillingDocumentWS/api/documentbill/create`
        ,{},    {  });      
      });

    } 
    
    }

}
