import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { PlansProvider } from "../../providers/plans/plans";
/**
 * Generated class for the PublicPlanProUnidosPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-public-plan-pro-unidos',
  templateUrl: 'public-plan-pro-unidos.html',
})
export class PublicPlanProUnidosPage {
  private plans:any;
  constructor(public navCtrl: NavController, public navParams: NavParams,plansProvider:PlansProvider ) {
    plansProvider.isDeveloper("sfsdf");
    var typePlan={
      "idOperator": "ESMERO",
      "idTerritorialDivision": 38,
      "idTerritorialDivisionLevel": 1,
      "idTypeSubscriber": 2,
      "idTypePlan": "I",
      "requestDate": "2019-05-06T00:00:00"
    }
   
    plansProvider.getTariffPlanList("",typePlan).then(data => {
      this.plans=data.tariffPlanList;
    }) ;
   
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad PublicPlanProUnidosPage');
  }

}
