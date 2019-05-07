import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, NgModule } from '@angular/core';
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular';
import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';
import { ListPage } from '../pages/list/list';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';
import { IonicStorageModule } from '@ionic/storage';
import { LoginPage } from '../pages/login/login';
import { LoginCheckPage } from '../pages/login-check/login-check';
import { LoginAccessPage } from '../pages/login-access/login-access';
import { AcercaPage } from '../pages/acerca/acerca';
import { TabsPage } from '../pages/tabs/tabs';
import { RegisterPage } from '../pages/register/register';
import { RegisterAddressPage } from '../pages/register-address/register-address';
import { RegisterAddCodePage } from '../pages/register-add-code/register-add-code';
import { ConsumptionPage } from '../pages/consumption/consumption';
import { InvoicesPage } from '../pages/invoices/invoices';
import { HelpPage } from '../pages/help/help';
import { PlansPage } from '../pages/plans/plans';
import { PlanProPage } from '../pages/plan-pro/plan-pro';
import { PlanIlimitadoPage } from '../pages/plan-ilimitado/plan-ilimitado';

import { PersonalAddressPage } from '../pages/personal-address/personal-address';
import { PlanProUnidosPage } from '../pages/plan-pro-unidos/plan-pro-unidos';
import { LineStatusPage } from '../pages/line-status/line-status';
import { ConsumptionProvider } from '../providers/consumption/consumption';


import { HttpClientModule } from '@angular/common/http'; 
import { PersonalInformationPage } from '../pages/personal-information/personal-information';
import { PersonalInformationProvider } from '../providers/personal-information/personal-information';
import { GenerateCodeProvider } from '../providers/generate-code/generate-code';
import { SubscriberInformationProvider } from '../providers/subscriber-information/subscriber-information';
import { LoginProvider } from '../providers/login/login';

import { HTTP } from '@ionic-native/http';
import { CloseSessionProvider } from '../providers/close-session/close-session';
import {PublicPlansPage  } from "../pages/public-plans/public-plans";
import { PublicPlanProPage } from "../pages/public-plan-pro/public-plan-pro";
import { PublicPlanIlimitadoPage } from "../pages/public-plan-ilimitado/public-plan-ilimitado";
import { PublicPlanProUnidosPage } from "../pages/public-plan-pro-unidos/public-plan-pro-unidos";
import { PlansProvider } from '../providers/plans/plans';

@NgModule({
  declarations: [
    AcercaPage,
    ConsumptionPage,
    InvoicesPage,
    TabsPage,
    HelpPage,
    MyApp,
    HomePage,
    ListPage,
    LoginPage,
    LoginCheckPage,
    LoginAccessPage,
    RegisterPage,
    RegisterAddressPage,
    PlansPage,
    PlanProPage,
    PlanIlimitadoPage,
    PersonalAddressPage,
    RegisterAddCodePage,
    PlanProUnidosPage,
    LineStatusPage,
    PersonalInformationPage,
    PublicPlansPage,
    PublicPlanProPage,
    PublicPlanIlimitadoPage,
    PublicPlanProUnidosPage
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(MyApp),
    HttpClientModule,
    IonicStorageModule.forRoot()
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    AcercaPage,
    ConsumptionPage,
    InvoicesPage,
    TabsPage,
    HelpPage,
    MyApp,
    HomePage,
    ListPage,
    LoginPage,
    LoginCheckPage,
    LoginAccessPage,
    RegisterPage,
    RegisterAddressPage,
    PlansPage,
    PlanProPage,
    PlanIlimitadoPage,    
    PersonalAddressPage,
    RegisterAddCodePage,
    PlanProUnidosPage,
    LineStatusPage,
    PersonalInformationPage,
    PublicPlansPage,
    PublicPlanProPage,
    PublicPlanIlimitadoPage,
    PublicPlanProUnidosPage
  ],
  providers: [
    StatusBar,
    SplashScreen,
    {provide: ErrorHandler, useClass: IonicErrorHandler},
    ConsumptionProvider,
    HttpClientModule,
    PersonalInformationProvider,
    GenerateCodeProvider,
    SubscriberInformationProvider,
    LoginProvider,
    HTTP,
    CloseSessionProvider,
    PlansProvider,
    
  ]
})
export class AppModule {}