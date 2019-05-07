import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, LoadingController } from 'ionic-angular';
import { ConsumptionProvider } from '../../providers/consumption/consumption';
import { Storage } from '@ionic/storage';
@IonicPage()
@Component({
  selector: 'page-consumption',
  templateUrl: 'consumption.html',
})
export class ConsumptionPage {

  consumption: any={};
  lista:any=[];
  
  constructor(
    private storage: Storage,
    public consumptionProvider: ConsumptionProvider,
    public navCtrl: NavController, 
    public navParams: NavParams,
    public loadingController:LoadingController) {
      this.getTokenDatos();
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad ConsumptionPage');
  }

  getTokenDatos(){
    /*this.storage.get('authcToken').then((val) => {
      console.log('ver token', val);
      this.getDatos(val);
    })*/
    Promise.all([this.storage.get("authcToken"), this.storage.get("numberPhone")]).then(values => {
      console.log(`Valor authcToken ${values[0]}`);
      console.log(`Valor numberPhone ${values[1]}`);    
      this.getDatos(values[0],values[1]); 
    });
    
  }

  getDatos(token:string,nPhone : string) {  
    let showLoadind = this.loadingController.create({
      content: "Cargando datos"
    })
    showLoadind.present();
    this.consumptionProvider.getConsumption(token,nPhone)
      .then(data => {      
        this.consumption = data;       
        console.log(`code: ${data['code']}    `)
        console.log(`data: ${data["message"]} `)
        //console.log(JSON.stringify(data))
        console.log(`planDtoList:  ${data["planDtoList"]}`)
        console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++");
        console.log(data["consumptionDtoList"])
        this.lista=data["consumptionDtoList"];
        console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++");
        showLoadind.dismiss();
      })
      .catch(err => {
        console.error('Error getDatos(): ', err );
        showLoadind.dismiss();
      });
  }


}
