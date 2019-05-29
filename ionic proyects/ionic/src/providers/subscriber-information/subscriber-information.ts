import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoadingController, Platform } from 'ionic-angular';
import { API_CONFIG } from "../../config/api.js";

import { HTTP } from '@ionic-native/http';

@Injectable()
export class SubscriberInformationProvider {

  constructor(
    public httpClient: HttpClient, 
    public loadingController:LoadingController,
    private httpN:HTTP, 
    public platform: Platform) {
    console.log('Hello SubscriberInformationProvider Provider');
  }

  getSubscriberInformation(token:string,nPhone : string){
    let showLoadind = this.loadingController.create({
      content: "Cargando datos"
    })
    showLoadind.present();

    return new Promise(resolve => {
      this.httpClient.get(`${API_CONFIG.baseAPI}portal/getSubscriberInformation/${nPhone}/${API_CONFIG.operator}`,
      {headers: {'token':`${token}`}}).subscribe(data => {
      resolve(data);
        showLoadind.dismiss();
      }, 
      err => {
        console.log("* Error getSubscriberInformation() *")
        console.log(err);
        showLoadind.dismiss();
      });
    });

  }

  getData2(){
    this.platform.ready().then(() => {  //Plataforma lista
 
      //let headers = new Headers();
      // headers.append('Content-Type', 'application/json');
      // headers.append('Authorization', 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMC9hcGkvbG9naW4iLCJpYXQiOjE1NTU4Njc3NjIsImV4cCI6MTU1NTk1NDE2MiwibmJmIjoxNTU1ODY3NzYyLCJqdGkiOiIxS052ZVVoenV6QUJIN0NVIn0.eKL5-80plAKrB38ZYrzHIGxFZbQgNN0LMVluLRYIss0');            
       this.httpN.get('http://192.168.119.84:16080/MobileEndPoint/api/portal/getSubscriberInformation/75663344/ESMERO', {}, {"Content-Type": "application/json","token":"NzU2NjMzNDQ7NWZmYmJjZTItMjM2Ni00YTBjLWE0ZWUtMzJmN2Y3ZTc4NDRh"})
      .then(data => {
        console.log("data.status: " + data.status);
        console.log("data.data: " + data.data); // data received by server
        console.log("data.headers: " + data.headers);
      })
      .catch(error => {
        console.log("error.status: " + error.status);
        console.log("error.error: " + error.error); // error message as string
        console.log("error.headers: " +error.headers);
      });


    });
  }  

}
