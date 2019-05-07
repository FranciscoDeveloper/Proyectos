import { Component, ViewChild } from '@angular/core';
import { Nav, Platform, LoadingController, AlertController } from 'ionic-angular';
import { StatusBar } from '@ionic-native/status-bar';
import { Storage } from '@ionic/storage';
import { SplashScreen } from '@ionic-native/splash-screen';
import { LoginPage } from '../pages/login/login';
import { PlansPage } from '../pages/plans/plans';
import { LineStatusPage } from '../pages/line-status/line-status';
import { PersonalInformationPage } from '../pages/personal-information/personal-information';
import { TabsPage } from '../pages/tabs/tabs';
import { SubscriberInformationProvider } from '../providers/subscriber-information/subscriber-information';
import { CloseSessionProvider } from '../providers/close-session/close-session';

export interface PageInterface {
  title: string;
  name: string;
  component: any;
  icon: string;
  index?: number;
  tabName?: string;
  tabComponent?: any;
}

@Component({
  templateUrl: 'app.html'
})
export class MyApp {

  //rootPage:any = TabsPage;
  rootPage: any = LoginPage;


  //SubscriberInformationProvider

  pages: PageInterface[] = [
    { title: 'Contratación', name: 'PlansPage', component: PlansPage, icon: 'stats' },
    { title: 'Mis datos', name: 'PersonalInformationPage', component: PersonalInformationPage, icon: 'card' },
    { title: 'Mis Gestiones', name: 'LineStatusPage', component: LineStatusPage, icon: 'briefcase' },
  ];
  /*
  loggedOutPages: PageInterface[] = [
    { title: 'Login', name: 'LoginPage', component: LoginPage, icon: 'log-in' },
    { title: 'Support', name: 'SupportPage', component: SupportPage, icon: 'help' },
    { title: 'Signup', name: 'SignupPage', component: SignupPage, icon: 'person-add' }
  ];
  */
  //  { title: 'Login', name: 'LoginPage', component: IntroPage, icon: 'log-in' },
  /*loggedOutPages: PageInterface[] = [
    { title: 'Soporte', name: 'SupportPage', component: LoginPage, icon: 'help' },
    { title: 'Cerrar session', name: 'SignupPage', component: LoginPage, icon: 'person-add' }
  ];*/

  loggedOutPages: PageInterface[] = [
    { title: 'Soporte', name: 'SupportPage', component: LoginPage, icon: 'help' }
  ];

  lista: any = [];

  fullName;
  phoneNumber;
  @ViewChild(Nav) nav: Nav;
  constructor(platform: Platform,
    statusBar: StatusBar,
    splashScreen: SplashScreen,
    private storage: Storage,
    public subscriberInformationProvider: SubscriberInformationProvider,
    public closeSessionProvider: CloseSessionProvider,
    public loadingController: LoadingController,
    public alertController: AlertController) {

    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      statusBar.styleDefault();
      splashScreen.hide();
    });

    //this.getSubscriberInformation();
    this.getTokenDatos();
  }

  getTokenDatos() {
    Promise.all([this.storage.get("authcToken"), this.storage.get("numberPhone")]).then(values => {
      console.log(`Valor app.component authcToken ${values[0]}`);
      console.log(`Valor app.component numberPhone ${values[1]}`);
      //this.getSubscriberInformation(values[0],values[1]); 
      this.subscriberInformationProvider.getData2();
    });

  }

  /*getSubscriberInformation(token:string,nPhone : string) {
    this.subscriberInformationProvider.getSubscriberInformation(token,nPhone)
      .then(data => {      
        this.lista = data;       
        this.fullName= `${this.lista['name']}  ${this.lista["lastName1"]}`;
        this.phoneNumber=this.lista['phoneNumber'];
        this.storage.set('idSubscriberType', this.lista["idSubscriberType"]);

        console.log("Verrr: " +  JSON.stringify(this.lista ));
      })
      .catch(err => {
        console.error('Error getSubscriberInformation: ', err );
      });
  }*/

  openPage(page: PageInterface) {
    let params = {};

    // The index is equal to the order of our tabs inside tabs.ts
    if (page.index) {
      params = { tabIndex: page.index };
    }

    // If tabs page is already active just change the tab index
    if (this.nav.getActiveChildNavs().length && page.index != undefined) {
      this.nav.getActiveChildNavs()[0].select(page.index);
    } else {
      // Tabs are not active, so reset the root page 
      // In this case: moving to or from SpecialPage
      this.nav.setRoot(page.component, params);
    }
  }

  isActive(page: PageInterface) {
    // Again the Tabs Navigation
    let childNav = this.nav.getActiveChildNavs()[0];

    if (childNav) {
      if (childNav.getSelected() && childNav.getSelected().root === page.tabComponent) {
        return 'primary';
      }
      return;
    }

    // Fallback needed when there is no active childnav (tabs not active)
    if (this.nav.getActive() && this.nav.getActive().name === page.name) {
      return 'primary';
    }
    return;
  }

  closeSession() {
    let showLoadind = this.loadingController.create({
      content: "Cerrando sesión"
    })

    showLoadind.present();

    try {
      Promise.all([this.storage.get("authcToken"), this.storage.get("numberPhone")]).then(values => {
        let storageResponse = values;
        showLoadind.present();
        this.closeSessionProvider.logOut(storageResponse).then(data => {
          showLoadind.dismiss();
          this.storage.clear();
          this.nav.setRoot(LoginPage);
        })

      })
    } catch (error) {
      console.log("LOG ERROR closeSession " + error);
      this.presentAlert(999);
      this.storage.clear();
      showLoadind.dismiss();
    }

  }

  async presentAlert(code: any) {
    var alert: any;

    switch (code) {
      case 401:
        alert = await this.alertController.create({
          message: 'Operación exitosa.',
          buttons: ['OK']
        });
        await alert.present();
        break;

      default:
        alert = await this.alertController.create({
          message: 'Lo sentimos estamos teniendo problemas de conexión.',
          buttons: ['OK']
        });
        await alert.present();
        break;
    }

  }


}