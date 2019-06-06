import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { RecargasProvider } from '../../providers/recargas/recargas';
import { Storage } from '@ionic/storage';
import { PageErrorPage } from '../page-error/page-error';
/**
 * Generated class for the ListRecargasPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-list-recargas',
  templateUrl: 'list-recargas.html',
})
export class ListRecargasPage {
   private historys:any;
   private token;string;
   private pageInit:number;
   private pageFin:number;
   private showPages:boolean;
  constructor(private storage: Storage,public navCtrl: NavController, public navParams: NavParams,recargasProvider:RecargasProvider) {  
 //   let idSubscriberNumber='100000';

    try {
      Promise.all([this.storage.get("authcToken"), this.storage.get("idSubscriber")]).then(values => {
        let storageResponse = values;
       
        recargasProvider.getBusinessDetailRechargeIdSubscriber(storageResponse).then(data => {
          console.log(data);
          this.historys=data;
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
  ionViewDidLoad() {
    console.log('ionViewDidLoad ListRecargasPage');
  }

}
