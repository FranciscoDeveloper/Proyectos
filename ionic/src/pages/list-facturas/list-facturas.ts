import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { FacturasProvider } from '../../providers/facturas/facturas';
import { Storage } from '@ionic/storage';
import { API_CONFIG } from "../../config/api.js";
import 'rxjs/add/operator/map';
import { DomSanitizer } from '@angular/platform-browser';
import { PageErrorPage } from '../page-error/page-error';
/**
 * Generated class for the ListFacturasPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-list-facturas',
  templateUrl: 'list-facturas.html',
})
export class ListFacturasPage {
  private historys:any;
  private token;string;
  private baseUrl:string;
  private extention:string;
  private facturasProvider:FacturasProvider;
  private   fileUrl:any;
  private pageInit:number;
  private pageFin:number;
  private showPages:boolean;
  constructor(private storage: Storage,public navCtrl: NavController,
     public navParams: NavParams,facturasProvider:FacturasProvider,private sanitizer: DomSanitizer) {
      this.baseUrl=API_CONFIG.facturaPath;
      this.extention=API_CONFIG.extention;
      this.pageInit=0;
      this.pageFin=5;
      try {
        this.facturasProvider=facturasProvider;
        Promise.all([this.storage.get("authcToken"), this.storage.get("idAccount")]).then(values => {
          let storageResponse = values;
          facturasProvider.summaryGetByIdAccount(storageResponse).then(data => {
            this.historys=data;
            console.log(data.length);
            this.showPages=data.length>0;
          }).catch(error => {
            console.log(error.status);
            console.log(error.error); // error message as string
            console.log(error.headers);
            this.navCtrl.push(PageErrorPage,{});
          });  
        });

      
      } catch (error) {
        console.log("LOG ERROR closeSession " + error);
        this.storage.clear();
      }
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad ListFacturasPage');
  }
 

  clickEvent(){
    this.facturasProvider.getPDF().then(response=>{
  
     // const blob = new Blob([this.base64ToArrayBuffer(response)], { type: 'application/pdf' });

   //   this.fileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
    })
  }


  base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
        console.log(bytes[i]);
    }
    return bytes.buffer;
  }



  getPrev() {
 
    if(this.pageInit>0 ){
      this.pageInit=this.pageInit-5;
      this.pageFin= this.pageFin-5;
    }
 
  } 


  getNext() {
    console.log(this.historys.length);
    console.log(this.pageFin);
    if(this.pageFin<this.historys.length){
      this.pageInit=this.pageFin;
      this.pageFin= this.pageFin+5;
    }
     
   
  } 
}