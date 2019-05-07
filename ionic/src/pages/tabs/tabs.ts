import { Component} from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Storage } from '@ionic/storage';
import { InvoicesPage } from '../invoices/invoices';
import { ConsumptionPage } from '../consumption/consumption';
import { HelpPage } from '../help/help';
import { SubscriberInformationProvider } from '../../providers/subscriber-information/subscriber-information';

@IonicPage()
@Component({
  selector: 'page-tabs',
  templateUrl: 'tabs.html',
})
export class TabsPage {
  
  name='B';
  //name:any;
  lista:any=[];
  
  tab1Root=InvoicesPage;  
  tab2Root=ConsumptionPage;
  tab3Root=HelpPage;
  myIndex: number;

  constructor(public navCtrl: NavController, 
    public navParams: NavParams,
    public storage: Storage,
    public subscriberInformationProvider:SubscriberInformationProvider) {
    this.myIndex = navParams.data.tabIndex || 0;
    //this.typeClient(4);
    this.getidSubscriberType();
  }


  getidSubscriberType(){
    this.storage.get('idSubscriberType').then((val) => {
      console.log('idSubscriberType', val);
      this.typeClient(val);
    })
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad TabsPage');
  }


  typeClient(idSubscriberType:number){
    console.log("idSubscriberType: " + idSubscriberType );
    switch (idSubscriberType) {
      case 1:
        console.log("Case 1");
        this.name="Boleta";
        break;
      case 2:
        console.log("Case 2");
        this.name="Boleta";
        break;
      case 3:
      console.log("Case 3");
      this.name="Saldo";
        break;
      case 4:
      console.log("Case 4");
      this.name="Saldo";
        break;
      default:
        break;
    }
  
  }

}
