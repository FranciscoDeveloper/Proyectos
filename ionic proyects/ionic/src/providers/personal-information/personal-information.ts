import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoadingController } from 'ionic-angular';


@Injectable()
export class PersonalInformationProvider {

  constructor(public httpClient: HttpClient, public loadingController:LoadingController) {
    console.log('Hello PersonalInformationProvider Provider');
  }

  getPersonalInformation() {   
    
    let showLoadind = this.loadingController.create({
      content: "Cargando datos"
    })

    showLoadind.present();

    //let headers = new HttpHeaders();
    /*headers.append('Content-Type', 'application/json');
    headers.append('Access-Control-Allow-Origin', '*');
    headers.append('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
    headers.append('Accept', 'application/json');
    //headers.append('token', 'NzU2NjMzNDQ7M2ZhYTYyZjktNDBiZC00NzIwLWE4YjAtOGJjNDM3YjAzYzBl' );
    headers.append('Access-Control-Allow-Headers', 'X-Requested-With');
    headers.append('Authorization' , 'NzU2NjMzNDQ7M2ZhYTYyZjktNDBiZC00NzIwLWE4YjAtOGJjNDM3YjAzYzBl');*/


   // console.log("header: " + JSON.stringify(headers));

    return new Promise(resolve => {
        this.httpClient.get("http://192.168.119.84:16080/MobileEndPoint/api/portal/getSubscriberInformation/75663344/ESMERO",{
          headers: {'token':'NzU2NjMzNDQ7M2ZhYTYyZjktNDBiZC00NzIwLWE4YjAtOGJjNDM3YjAzYzBl'}
       }).subscribe(data => {
          resolve(data);
          showLoadind.dismiss();
        }, 
        err => {
          console.log("* Error getPersonalInformation() *")
          console.log(err);
          showLoadind.dismiss();
        });
    });
  }

}
