webpackJsonp([22],{

/***/ 109:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return ConsumptionPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__providers_consumption_consumption__ = __webpack_require__(180);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__ionic_storage__ = __webpack_require__(28);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};




var ConsumptionPage = /** @class */ (function () {
    function ConsumptionPage(storage, consumptionProvider, navCtrl, navParams, loadingController) {
        this.storage = storage;
        this.consumptionProvider = consumptionProvider;
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        this.loadingController = loadingController;
        this.consumption = {};
        this.lista = [];
        this.getTokenDatos();
    }
    ConsumptionPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad ConsumptionPage');
    };
    ConsumptionPage.prototype.getTokenDatos = function () {
        var _this = this;
        /*this.storage.get('authcToken').then((val) => {
          console.log('ver token', val);
          this.getDatos(val);
        })*/
        Promise.all([this.storage.get("authcToken"), this.storage.get("numberPhone")]).then(function (values) {
            console.log("Valor authcToken " + values[0]);
            console.log("Valor numberPhone " + values[1]);
            _this.getDatos(values[0], values[1]);
        });
    };
    ConsumptionPage.prototype.getDatos = function (token, nPhone) {
        var _this = this;
        var showLoadind = this.loadingController.create({
            content: "Cargando datos"
        });
        showLoadind.present();
        this.consumptionProvider.getConsumption(token, nPhone)
            .then(function (data) {
            _this.consumption = data;
            console.log("code: " + data['code'] + "    ");
            console.log("data: " + data["message"] + " ");
            //console.log(JSON.stringify(data))
            console.log("planDtoList:  " + data["planDtoList"]);
            console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++");
            console.log(data["consumptionDtoList"]);
            _this.lista = data["consumptionDtoList"];
            console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++");
            showLoadind.dismiss();
        })
            .catch(function (err) {
            console.error('Error getDatos(): ', err);
            showLoadind.dismiss();
        });
    };
    ConsumptionPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-consumption',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/consumption/consumption.html"*/'<ion-header>\n    <ion-navbar color="bg-alma">\n     \n      <button ion-button menuToggle>\n          <ion-icon name="more"></ion-icon>\n      </button>\n      \n      <ion-buttons end>\n        <button ion-button icon-only>\n            <img src="assets/imgs/logo-h.png" width="75" alt="user">\n        </button>\n      </ion-buttons>\n  \n    </ion-navbar>\n</ion-header>\n\n<ion-content padding>\n\n  <ion-card class="card-alma" >\n    <hr/>\n\n    <!--\n    <ion-grid>\n      <ion-row>\n        <ion-col col-4>DATOS</ion-col>\n        <ion-col col-4>MINUTOS</ion-col>\n        <ion-col col-4>SMS</ion-col>\n      </ion-row>\n    </ion-grid> \n    -->\n\n    <ion-grid>\n      <ion-row>      \n        <ion-col *ngFor="let l of lista" col-4>\n          {{l.typetrafficdescription}} \n          <br/><br/> {{l.totalunits}}\n        </ion-col>           \n      </ion-row>\n    </ion-grid> \n\n    \n    <!--\n    <ion-list>\n      <ion-item-sliding *ngFor="let l of lista" >\n        <ion-item>        \n          <h3>{{l.typetrafficdescription}} - {{l.totalunits}}</h3>       \n        </ion-item>\n      </ion-item-sliding>\n    </ion-list>\n    -->\n\n    \n  </ion-card>\n\n</ion-content>'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/consumption/consumption.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_3__ionic_storage__["b" /* Storage */],
            __WEBPACK_IMPORTED_MODULE_2__providers_consumption_consumption__["a" /* ConsumptionProvider */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["f" /* LoadingController */]])
    ], ConsumptionPage);
    return ConsumptionPage;
}());

//# sourceMappingURL=consumption.js.map

/***/ }),

/***/ 110:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return HelpPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};


var HelpPage = /** @class */ (function () {
    function HelpPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    HelpPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad HelpPage');
    };
    HelpPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-help',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/help/help.html"*/'<ion-header>\n    <ion-navbar color="bg-alma">\n     \n      <button ion-button menuToggle>\n          <ion-icon name="more"></ion-icon>\n      </button>\n      \n      <ion-buttons end>\n        <button ion-button icon-only>\n            <img src="assets/imgs/logo-h.png" width="75" alt="user">\n        </button>\n      </ion-buttons>\n  \n    </ion-navbar>\n  </ion-header>\n\n<ion-content padding>\n\n  <ion-card class="card-alma" >\n       \n    <ion-icon name="help" class="icon-help"></ion-icon>\n    <h1 class="tit"><strong>AYUDA</strong></h1><br><br>\n\n    <h2><strong>Si necesitas mas informacion o tienes dudas, te ayudamos</strong></h2><br><br>\n\n    <button ion-button class="btn-circ-a"> Whatsapp a ejecutivo</button><br>\n    \n    <!--\n    <button ion-button class="btn-circ-n"> Centro de ayuda</button><br> \n    -->\n\n  </ion-card>\n\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/help/help.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], HelpPage);
    return HelpPage;
}());

//# sourceMappingURL=help.js.map

/***/ }),

/***/ 111:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return InvoicesPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};


var InvoicesPage = /** @class */ (function () {
    //Llamar el (storage) (tabs)
    function InvoicesPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    InvoicesPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad InvoicesPage');
    };
    InvoicesPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-invoices',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/invoices/invoices.html"*/'<ion-header>\n  <ion-navbar color="bg-alma">\n   \n    <button ion-button menuToggle>\n        <ion-icon name="more"></ion-icon>\n    </button>\n    \n    <ion-buttons end>\n      <button ion-button icon-only>\n          <img src="assets/imgs/logo-h.png" width="75" alt="user">\n      </button>\n    </ion-buttons>\n\n  </ion-navbar>\n</ion-header>\n\n<ion-content padding>\n\n  <ion-card class="card-alma" >\n    <img src="https://cdn.pixabay.com/photo/2014/08/05/10/30/iphone-410324__340.jpg" height="140px"/>\n    <ion-card-content>    \n\n      <h2><strong>Total a pagar Enero</strong></h2>\n      <h1 class="tit"><strong>$23.981</strong></h1>\n\n      <hr/>\n      <ion-grid>\n          <ion-row>\n            <ion-col col-6>Saldo anterior</ion-col>\n            <ion-col col-6>Total mes</ion-col>\n          </ion-row>\n          <ion-row>\n            <ion-col col-6>$0</ion-col>\n            <ion-col col-6>$23.981</ion-col>\n          </ion-row>\n        </ion-grid>\n      <hr/>\n\n      <button ion-button class="btn-circ-a">PLAN PRO</button><br>\n      <button ion-button class="btn-circ-n">PLAN PRO UNIDOS</button><br>\n    </ion-card-content>\n  </ion-card>\n\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/invoices/invoices.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], InvoicesPage);
    return InvoicesPage;
}());

//# sourceMappingURL=invoices.js.map

/***/ }),

/***/ 112:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return LineStatusPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__tabs_tabs__ = __webpack_require__(16);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};



var LineStatusPage = /** @class */ (function () {
    function LineStatusPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    LineStatusPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad LineStatusPage');
    };
    LineStatusPage.prototype.btnBegin = function () {
        this.navCtrl.setRoot(__WEBPACK_IMPORTED_MODULE_2__tabs_tabs__["a" /* TabsPage */]);
    };
    LineStatusPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-line-status',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/line-status/line-status.html"*/'<ion-header>\n  <ion-navbar color="bg-alma">\n    <button ion-button menuToggle>\n      <ion-icon name="more"></ion-icon>\n    </button>\n    \n    <ion-buttons end>\n      <button ion-button icon-only  (click)="btnBegin()">\n          <img src="assets/imgs/logo-h.png" width="75" alt="user">\n      </button>\n    </ion-buttons>\n      \n  </ion-navbar>\n  \n</ion-header>\n\n\n<ion-content padding>\n\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/line-status/line-status.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], LineStatusPage);
    return LineStatusPage;
}());

//# sourceMappingURL=line-status.js.map

/***/ }),

/***/ 113:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return LoginAccessPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__tabs_tabs__ = __webpack_require__(16);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__ionic_storage__ = __webpack_require__(28);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__providers_login_login__ = __webpack_require__(183);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};





var LoginAccessPage = /** @class */ (function () {
    function LoginAccessPage(storage, navCtrl, navParams, loginProvider) {
        this.storage = storage;
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        this.loginProvider = loginProvider;
        this.responseLogin = {};
        this.getCode();
        this.nPhone = navParams.get('numberPhone');
        console.log("NUMERO DE TELEFONO RECIBIDO " + this.nPhone);
    }
    LoginAccessPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad LoginAccessPage');
    };
    LoginAccessPage.prototype.getCode = function () {
        this.storage.get('genericCode').then(function (val) {
            console.log('Your genericCode', val);
        });
    };
    LoginAccessPage.prototype.btnAccess = function () {
        var _this = this;
        try {
            var verificatorCode = this.verificatorDigit(this.cod1, this.cod2, this.cod3, this.cod4);
            console.log("TELEFONO A ENVIAR********* " + this.nPhone);
            console.log("CODIGO VERIFICADOR " + verificatorCode);
            this.loginProvider.login(this.nPhone, verificatorCode)
                .then(function (data) {
                console.log("Ver data: " + data);
                console.log("typeof data: " + typeof data);
                _this.responseLogin = data;
                console.log("*****************LOGIN***********");
                console.log("data loginProvider: " + data["message"]);
                console.log(JSON.stringify(data));
                console.log("authcToken: " + data["authcToken"]);
                _this.responseLogin = data["authcToken"];
                _this.storage.set('authcToken', _this.responseLogin);
                _this.storage.set('numberPhone', _this.nPhone);
                _this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_2__tabs_tabs__["a" /* TabsPage */], {});
            });
        }
        catch (error) {
            console.log(error);
        }
    };
    LoginAccessPage.prototype.verificatorDigit = function (cod1, cod2, cod3, cod4) {
        var verificatorCode;
        try {
            verificatorCode = cod1 + cod2 + cod3 + cod4;
        }
        catch (error) {
            console.log(error);
        }
        return verificatorCode;
    };
    LoginAccessPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-login-access',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/login-access/login-access.html"*/'<ion-content class="bg-login">\n    <img src="/assets/imgs/logo-blanco.png" class="logo"/>\n  \n    <h1>Ingresa el código de 4 digitos enviad al +56 9 1234 5678</h1>\n\n    <ion-grid>\n      <ion-row>\n          <ion-col col-3>\n              <ion-item class="datosLogin">\n                  <ion-input type="number" [(ngModel)]="cod1" maxlength="1" ></ion-input>\n                </ion-item>\n          </ion-col>\n\n          <ion-col col-3>\n              <ion-item class="datosLogin">\n                  <ion-input type="number" [(ngModel)]="cod2" maxlength="1"></ion-input>\n                </ion-item>\n          </ion-col>\n\n          <ion-col col-3>\n              <ion-item class="datosLogin">\n                  <ion-input type="number" [(ngModel)]="cod3" maxlength="1"></ion-input>\n                </ion-item>\n          </ion-col>\n\n          <ion-col col-3>\n              <ion-item class="datosLogin">\n                  <ion-input type="number" [(ngModel)]="cod4" maxlength="1"></ion-input>\n                </ion-item>\n          </ion-col>\n      </ion-row>\n    </ion-grid>\n\n      \n\n    <button ion-button round (click)="btnAccess()" class="cta-naranjo">\n        Acceder \n        <ion-icon name="arrow-round-forward"></ion-icon>\n    </button>\n\n    <p>¿No recibiste el código? <a href="#" class="link-a">Reeviar</a></p>\n    \n  </ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/login-access/login-access.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_3__ionic_storage__["b" /* Storage */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */],
            __WEBPACK_IMPORTED_MODULE_4__providers_login_login__["a" /* LoginProvider */]])
    ], LoginAccessPage);
    return LoginAccessPage;
}());

//# sourceMappingURL=login-access.js.map

/***/ }),

/***/ 114:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return LoginPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__login_check_login_check__ = __webpack_require__(46);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__register_register__ = __webpack_require__(115);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__tabs_tabs__ = __webpack_require__(16);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__ionic_storage__ = __webpack_require__(28);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__public_plans_public_plans__ = __webpack_require__(118);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};







var LoginPage = /** @class */ (function () {
    function LoginPage(navCtrl, navParams, storage, menuCtrl) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        this.storage = storage;
        this.menuCtrl = menuCtrl;
        this.verifyStorage();
        //this.menuCtrl.enable(false);
    }
    LoginPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad LoginPage');
    };
    LoginPage.prototype.btnRediret = function () {
        console.log("Entrando btn redirect Login");
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_2__login_check_login_check__["a" /* LoginCheckPage */], {});
    };
    LoginPage.prototype.btnRegister = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_3__register_register__["a" /* RegisterPage */], {});
    };
    LoginPage.prototype.btnPublicPlans = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_6__public_plans_public_plans__["a" /* PublicPlansPage */], {});
    };
    LoginPage.prototype.verifyStorage = function () {
        var _this = this;
        this.storage.get('authcToken').then(function (val) {
            if (val == '' || val == null) {
                return;
            }
            _this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_4__tabs_tabs__["a" /* TabsPage */], {});
            console.log('Your genericCode', val);
        });
    };
    LoginPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-login',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/login/login.html"*/'<ion-content class="bg-login">\n  \n  <img src="/assets/imgs/logo-blanco.png" class="logo"/>\n\n  <h1>¿Ya tienes una cuenta?</h1>\n\n  <button ion-button (click)="btnRediret()" class="cta-naranjo">Inicia sesión</button>\n  <p>No poseo una cuenta,  <a (click)="btnPublicPlans()" class="link-a">Contratar</a></p>\n  \n  \n</ion-content>\n\n\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/login/login.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */],
            __WEBPACK_IMPORTED_MODULE_5__ionic_storage__["b" /* Storage */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["g" /* MenuController */]])
    ], LoginPage);
    return LoginPage;
}());

//# sourceMappingURL=login.js.map

/***/ }),

/***/ 115:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return RegisterPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__login_check_login_check__ = __webpack_require__(46);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__register_address_register_address__ = __webpack_require__(116);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};




/**
 * Generated class for the RegisterPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */
var RegisterPage = /** @class */ (function () {
    function RegisterPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    RegisterPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad RegisterPage');
    };
    RegisterPage.prototype.btnRediret = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_2__login_check_login_check__["a" /* LoginCheckPage */], {});
    };
    RegisterPage.prototype.btnRegisterAddress = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_3__register_address_register_address__["a" /* RegisterAddressPage */], {});
    };
    RegisterPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-register',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/register/register.html"*/'<ion-content class="bg-login">\n\n  <h1 class="titulo">Registrate</h1>\n\n    <ion-item class="datosLogin">\n      <ion-label floating>Nombre</ion-label>\n      <ion-input type="text"></ion-input>\n    </ion-item>\n\n    <ion-item class="datosLogin">\n      <ion-label floating>Apellido</ion-label>\n      <ion-input type="text"></ion-input>\n    </ion-item>\n\n    <ion-item class="datosLogin">\n      <ion-label floating>E-mail</ion-label>\n      <ion-input type="text"></ion-input>\n    </ion-item>\n\n      <br>\n\n  <button ion-button (click)="btnRegisterAddress()" class="cta-naranjo">Siguiente</button>\n  <p>Deseas iniciar sesión?,  <a href="#" (click)="btnRediret()" class="link-a">Ingresa aquí</a></p>\n  \n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/register/register.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], RegisterPage);
    return RegisterPage;
}());

//# sourceMappingURL=register.js.map

/***/ }),

/***/ 116:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return RegisterAddressPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__login_check_login_check__ = __webpack_require__(46);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__register_add_code_register_add_code__ = __webpack_require__(117);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};




/**
 * Generated class for the RegisterAddressPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */
var RegisterAddressPage = /** @class */ (function () {
    function RegisterAddressPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    RegisterAddressPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad RegisterAddressPage');
    };
    RegisterAddressPage.prototype.btnRediret = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_2__login_check_login_check__["a" /* LoginCheckPage */], {});
    };
    RegisterAddressPage.prototype.btnAddCode = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_3__register_add_code_register_add_code__["a" /* RegisterAddCodePage */], {});
    };
    RegisterAddressPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-register-address',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/register-address/register-address.html"*/'<ion-content class="bg-login">\n\n    <h1 class="titulo">Dirección</h1>\n  \n      <ion-item class="datosLogin">\n        <ion-label floating>Dirección</ion-label>\n        <ion-input type="text"></ion-input>\n      </ion-item>\n  \n      <ion-item class="datosLogin">\n        <ion-label floating>N° Domicilio</ion-label>\n        <ion-input type="text"></ion-input>\n      </ion-item>\n\n      <br>\n  \n      <ion-item class="datosLogin">\n        <ion-label>Región</ion-label>\n        <ion-select [(ngModel)]="region">\n          <ion-option value="nes">1</ion-option>\n          <ion-option value="n64">2</ion-option>\n          <ion-option value="ps">3</ion-option>\n          <ion-option value="genesis">4</ion-option>\n          <ion-option value="saturn">5</ion-option>\n          <ion-option value="snes">6</ion-option>\n        </ion-select>\n      </ion-item>\n\n      <br>\n\n      <ion-item class="datosLogin">\n          <ion-label>Comuna</ion-label>\n          <ion-select [(ngModel)]="comuna">\n            <ion-option value="nes">1</ion-option>\n            <ion-option value="n64">2</ion-option>\n            <ion-option value="ps">3</ion-option>\n            <ion-option value="genesis">4</ion-option>\n            <ion-option value="saturn">5</ion-option>\n            <ion-option value="snes">6</ion-option>\n          </ion-select>\n        </ion-item>\n          \n      \n  \n        <br>\n  \n    <button ion-button (click)="btnAddCode()" class="cta-naranjo">Siguiente</button>\n    <p>Deseas iniciar sesión?,  <a href="#" (click)="btnRediret()" class="link-a">Solicitar aquí</a></p>\n    \n  </ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/register-address/register-address.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], RegisterAddressPage);
    return RegisterAddressPage;
}());

//# sourceMappingURL=register-address.js.map

/***/ }),

/***/ 117:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return RegisterAddCodePage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__tabs_tabs__ = __webpack_require__(16);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};



/**
 * Generated class for the RegisterAddCodePage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */
var RegisterAddCodePage = /** @class */ (function () {
    function RegisterAddCodePage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    RegisterAddCodePage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad RegisterAddCodePage');
    };
    RegisterAddCodePage.prototype.btnAccess = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_2__tabs_tabs__["a" /* TabsPage */], {});
    };
    RegisterAddCodePage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-register-add-code',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/register-add-code/register-add-code.html"*/'<ion-content class="bg-login">\n    <img src="/assets/imgs/logo-blanco.png" class="logo"/>\n  \n    <h1>Hemos enviado  SMS a tu móvil con tu código de acceso...</h1>\n\n    <ion-grid>\n      <ion-row>\n          <ion-col col-3>\n              <ion-item class="datosLogin">\n                  <ion-input type="text" maxlength="1"></ion-input>\n                </ion-item>\n          </ion-col>\n\n          <ion-col col-3>\n              <ion-item class="datosLogin">\n                  <ion-input type="text" maxlength="1"></ion-input>\n                </ion-item>\n          </ion-col>\n\n          <ion-col col-3>\n              <ion-item class="datosLogin">\n                  <ion-input type="text" maxlength="1"></ion-input>\n                </ion-item>\n          </ion-col>\n\n          <ion-col col-3>\n              <ion-item class="datosLogin">\n                  <ion-input type="text" maxlength="1"></ion-input>\n                </ion-item>\n          </ion-col>\n      </ion-row>\n    </ion-grid>\n\n      \n\n    <button ion-button round (click)="btnAccess()" class="cta-naranjo">\n        Acceder\n        <ion-icon name="arrow-round-forward"></ion-icon>\n    </button>\n\n    <p>¿No recibiste el código? <a href="#" class="link-a">Reeviar</a></p>\n    \n  </ion-content>'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/register-add-code/register-add-code.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], RegisterAddCodePage);
    return RegisterAddCodePage;
}());

//# sourceMappingURL=register-add-code.js.map

/***/ }),

/***/ 118:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PublicPlansPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__public_plan_pro_public_plan_pro__ = __webpack_require__(119);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__public_plan_ilimitado_public_plan_ilimitado__ = __webpack_require__(120);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__public_plan_pro_unidos_public_plan_pro_unidos__ = __webpack_require__(121);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__tabs_tabs__ = __webpack_require__(16);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};






/**
 * Generated class for the PublicPlansPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */
var PublicPlansPage = /** @class */ (function () {
    function PublicPlansPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    PublicPlansPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PlansPage');
    };
    PublicPlansPage.prototype.btnBegin = function () {
        this.navCtrl.setRoot(__WEBPACK_IMPORTED_MODULE_5__tabs_tabs__["a" /* TabsPage */]);
    };
    PublicPlansPage.prototype.btnPlanPro = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_2__public_plan_pro_public_plan_pro__["a" /* PublicPlanProPage */], {});
    };
    PublicPlansPage.prototype.btnPlanProUnidos = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_4__public_plan_pro_unidos_public_plan_pro_unidos__["a" /* PublicPlanProUnidosPage */], {});
    };
    PublicPlansPage.prototype.btnPlanIlimitado = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_3__public_plan_ilimitado_public_plan_ilimitado__["a" /* PublicPlanIlimitadoPage */], {});
    };
    PublicPlansPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-PublicPlans',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/public-plans/public-plans.html"*/'<ion-header>\n  <ion-navbar color="bg-alma">\n    <button ion-button menuToggle>\n      <ion-icon name="more"></ion-icon>\n    </button>\n    \n    <ion-buttons end>\n      <button ion-button icon-only  (click)="btnBegin()">\n          <img src="assets/imgs/logo-h.png" width="75" alt="user">\n      </button>\n    </ion-buttons>\n      \n  </ion-navbar>\n  \n</ion-header>\n\n<ion-content>\n    <ul class="breadcrumb">\n      <li><a href="#">Contratación </a><ion-icon name="arrow-forward" class="icon-breadcrump"></ion-icon></li>\n      <li class="active">Planes</li>\n    </ul>\n\n    <ion-card class="card-alma">\n\n        <ion-card-header>\n            <h1 class="tit"><em><strong>Pide tu Plan</strong></em></h1>\n        </ion-card-header>\n        \n      \n        <ion-card-content>\n          <!-- Add card content here! -->\n          <button (click)="btnPlanPro()" ion-button class="btn-circ-n">INDIVIDUAL</button><br>\n          <button (click)="btnPlanProUnidos()" ion-button class="btn-circ-n">UNIDOS</button><br>\n          <button (click)="btnPlanIlimitado()" ion-button class="btn-circ-n">GRUPAL</button>\n        </ion-card-content>\n\n        <p>Por que sabemos que necesitas el mejor plan, elige el que mas te guste!</p>\n      \n      </ion-card>\n\n\n\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/public-plans/public-plans.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], PublicPlansPage);
    return PublicPlansPage;
}());

//# sourceMappingURL=public-plans.js.map

/***/ }),

/***/ 119:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PublicPlanProPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__providers_plans_plans__ = __webpack_require__(52);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};





/**
 * Generated class for the PublicPlanProPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */
var PublicPlanProPage = /** @class */ (function () {
    function PublicPlanProPage(navCtrl, navParams, plansProvider) {
        var _this = this;
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        plansProvider.isDeveloper("sfsdf");
        var typePlan = {
            "idOperator": "ESMERO",
            "idTerritorialDivision": 38,
            "idTerritorialDivisionLevel": 1,
            "idTypeSubscriber": 2,
            "idTypePlan": "I",
            "requestDate": "2019-05-06T00:00:00"
        };
        plansProvider.getTariffPlanList("", typePlan).then(function (data) {
            _this.plans = data;
        });
    }
    PublicPlanProPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PublicPlanProPage');
    };
    PublicPlanProPage.prototype.goToSlide = function () {
        this.slides.slideTo(2, 500);
    };
    __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["_8" /* ViewChild */])(__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["l" /* Slides */]),
        __metadata("design:type", typeof (_a = typeof __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["l" /* Slides */] !== "undefined" && __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["l" /* Slides */]) === "function" && _a || Object)
    ], PublicPlanProPage.prototype, "slides", void 0);
    PublicPlanProPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-public-plan-pro',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/public-plan-pro/public-plan-pro.html"*/'<ion-header>\n  <ion-navbar color="bg-alma">\n    <button ion-button menuToggle>\n      <ion-icon name="more"></ion-icon>\n    </button>\n    \n    <ion-buttons end>\n      <button ion-button icon-only  (click)="btnBegin()">\n          <img src="assets/imgs/logo-h.png" width="75" alt="user">\n      </button>\n    </ion-buttons>\n      \n  </ion-navbar>\n\n</ion-header>\n\n<ion-content>\n\n\n<ion-slides >\n  <ion-slide *ngFor="let plan of plans">\n    <ion-card class="card-alma" >\n\n      <ion-card-header>\n          <h1 class="tit"><em><strong>{{plan.descriptionTariffPlan}}}</strong></em></h1>\n      </ion-card-header>\n    \n      <ion-card-content>\n        <!-- Add card content here! -->\n        \n        <p>Por la cantidad de días que necesites, Portate a Alma y obten el mejor Plan para tu familia <strong>¿Que esperas?</strong> </p>\n      \n               \n        <span class="tit"><strong>$500/</strong></span><strong>15 </strong>\n        <p>Redes sociales ilimitadas</p>\n        <ion-grid>\n          <ion-row>\n            <ion-col col-2>\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-facebook" md="logo-facebook"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-twitter" md="logo-twitter"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n            <ion-col col->\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n          </ion-row>\n      </ion-grid>\n     \n        <button ion-button class="btn-circ-n">CONTRATAR</button><br>\n       \n      </ion-card-content>\n    \n    </ion-card>\n  </ion-slide>\n \n</ion-slides>\n</ion-content>'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/public-plan-pro/public-plan-pro.html"*/,
        }),
        __metadata("design:paramtypes", [typeof (_b = typeof __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */] !== "undefined" && __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */]) === "function" && _b || Object, typeof (_c = typeof __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */] !== "undefined" && __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]) === "function" && _c || Object, typeof (_d = typeof __WEBPACK_IMPORTED_MODULE_2__providers_plans_plans__["a" /* PlansProvider */] !== "undefined" && __WEBPACK_IMPORTED_MODULE_2__providers_plans_plans__["a" /* PlansProvider */]) === "function" && _d || Object])
    ], PublicPlanProPage);
    return PublicPlanProPage;
    var _a, _b, _c, _d;
}());

//# sourceMappingURL=public-plan-pro.js.map

/***/ }),

/***/ 120:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PublicPlanIlimitadoPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__providers_plans_plans__ = __webpack_require__(52);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};



/**
 * Generated class for the PublicPlanIlimitadoPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */
var PublicPlanIlimitadoPage = /** @class */ (function () {
    function PublicPlanIlimitadoPage(navCtrl, navParams, plansProvider) {
        var _this = this;
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        plansProvider.isDeveloper("sfsdf");
        var typePlan = {
            "idOperator": "ESMERO",
            "idTerritorialDivision": 38,
            "idTerritorialDivisionLevel": 1,
            "idTypeSubscriber": 2,
            "idTypePlan": "I",
            "requestDate": "2019-05-06T00:00:00"
        };
        plansProvider.getTariffPlanList("", typePlan).then(function (data) {
            _this.plans = data;
        });
    }
    PublicPlanIlimitadoPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PublicPlanIlimitadoPage');
    };
    PublicPlanIlimitadoPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-public-plan-ilimitado',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/public-plan-ilimitado/public-plan-ilimitado.html"*/'<ion-header>\n  <ion-navbar color="bg-alma">\n    <button ion-button menuToggle>\n      <ion-icon name="more"></ion-icon>\n    </button>\n    \n    <ion-buttons end>\n      <button ion-button icon-only  (click)="btnBegin()">\n          <img src="assets/imgs/logo-h.png" width="75" alt="user">\n      </button>\n    </ion-buttons>\n      \n  </ion-navbar>\n\n</ion-header>\n\n<ion-content>\n\n\n<ion-slides >\n  <ion-slide *ngFor="let plan of plans">\n    <ion-card class="card-alma" >\n\n      <ion-card-header>\n          <h1 class="tit"><em><strong>{{plan.descriptionTariffPlan}}}</strong></em></h1>\n      </ion-card-header>\n    \n      <ion-card-content>\n        <!-- Add card content here! -->\n        \n        <p>Por la cantidad de días que necesites, Portate a Alma y obten el mejor Plan para tu familia <strong>¿Que esperas?</strong> </p>\n      \n               \n        <span class="tit"><strong>$500/</strong></span><strong>15 </strong>\n        <p>Redes sociales ilimitadas</p>\n        <ion-grid>\n          <ion-row>\n            <ion-col col-2>\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-facebook" md="logo-facebook"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-twitter" md="logo-twitter"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n            <ion-col col->\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n          </ion-row>\n      </ion-grid>\n     \n        <button ion-button class="btn-circ-n">CONTRATAR</button><br>\n       \n      </ion-card-content>\n    \n    </ion-card>\n  </ion-slide>\n \n</ion-slides>\n</ion-content>'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/public-plan-ilimitado/public-plan-ilimitado.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */], __WEBPACK_IMPORTED_MODULE_2__providers_plans_plans__["a" /* PlansProvider */]])
    ], PublicPlanIlimitadoPage);
    return PublicPlanIlimitadoPage;
}());

//# sourceMappingURL=public-plan-ilimitado.js.map

/***/ }),

/***/ 121:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PublicPlanProUnidosPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__providers_plans_plans__ = __webpack_require__(52);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};



/**
 * Generated class for the PublicPlanProUnidosPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */
var PublicPlanProUnidosPage = /** @class */ (function () {
    function PublicPlanProUnidosPage(navCtrl, navParams, plansProvider) {
        var _this = this;
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        plansProvider.isDeveloper("sfsdf");
        var typePlan = {
            "idOperator": "ESMERO",
            "idTerritorialDivision": 38,
            "idTerritorialDivisionLevel": 1,
            "idTypeSubscriber": 2,
            "idTypePlan": "I",
            "requestDate": "2019-05-06T00:00:00"
        };
        plansProvider.getTariffPlanList("", typePlan).then(function (data) {
            _this.plans = data.tariffPlanList;
        });
    }
    PublicPlanProUnidosPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PublicPlanProUnidosPage');
    };
    PublicPlanProUnidosPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-public-plan-pro-unidos',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/public-plan-pro-unidos/public-plan-pro-unidos.html"*/'<ion-header>\n  <ion-navbar color="bg-alma">\n    <button ion-button menuToggle>\n      <ion-icon name="more"></ion-icon>\n    </button>\n    \n    <ion-buttons end>\n      <button ion-button icon-only  (click)="btnBegin()">\n          <img src="assets/imgs/logo-h.png" width="75" alt="user">\n      </button>\n    </ion-buttons>\n      \n  </ion-navbar>\n\n</ion-header>\n\n<ion-content>\n\n\n<ion-slides >\n  <ion-slide *ngFor="let plan of plans">\n    <ion-card class="card-alma" >\n\n      <ion-card-header>\n          <h1 class="tit"><em><strong>{{plan.descriptionTariffPlan}}}</strong></em></h1>\n      </ion-card-header>\n    \n      <ion-card-content>\n        <!-- Add card content here! -->\n        \n        <p>Por la cantidad de días que necesites, Portate a Alma y obten el mejor Plan para tu familia <strong>¿Que esperas?</strong> </p>\n      \n               \n        <span class="tit"><strong>$500/</strong></span><strong>15 </strong>\n        <p>Redes sociales ilimitadas</p>\n        <ion-grid>\n          <ion-row>\n            <ion-col col-2>\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-facebook" md="logo-facebook"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-twitter" md="logo-twitter"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n            <ion-col col-2>\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n            <ion-col col->\n              <ion-icon ios="logo-instagram" md="logo-instagram"></ion-icon>\n            </ion-col>\n          </ion-row>\n      </ion-grid>\n     \n        <button ion-button class="btn-circ-n">CONTRATAR</button><br>\n       \n      </ion-card-content>\n    \n    </ion-card>\n  </ion-slide>\n \n</ion-slides>\n</ion-content>'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/public-plan-pro-unidos/public-plan-pro-unidos.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */], __WEBPACK_IMPORTED_MODULE_2__providers_plans_plans__["a" /* PlansProvider */]])
    ], PublicPlanProUnidosPage);
    return PublicPlanProUnidosPage;
}());

//# sourceMappingURL=public-plan-pro-unidos.js.map

/***/ }),

/***/ 122:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PersonalInformationPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__providers_personal_information_personal_information__ = __webpack_require__(185);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};



var PersonalInformationPage = /** @class */ (function () {
    function PersonalInformationPage(navCtrl, navParams, personalInformationProvider) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        this.personalInformationProvider = personalInformationProvider;
        this.personalInfo = {};
        this.getPersonalInformation();
    }
    PersonalInformationPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PersonalInformationPage');
    };
    PersonalInformationPage.prototype.getPersonalInformation = function () {
        var _this = this;
        this.personalInformationProvider.getPersonalInformation()
            .then(function (data) {
            _this.personalInfo = data;
            console.log("data: " + data["message"]);
            console.log(JSON.stringify(data));
        })
            .catch(function (err) {
            console.error('función enRechazo invocada: ', err);
        });
    };
    PersonalInformationPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-personal-information',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/personal-information/personal-information.html"*/'<!--\n  Generated template for the PersonalInformationPage page.\n\n  See http://ionicframework.com/docs/components/#navigation for more info on\n  Ionic pages and navigation.\n-->\n<ion-header>\n  <ion-navbar>\n    <ion-title>personalInformation</ion-title>\n  </ion-navbar>\n</ion-header>\n\n<ion-content padding>\n\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/personal-information/personal-information.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */],
            __WEBPACK_IMPORTED_MODULE_2__providers_personal_information_personal_information__["a" /* PersonalInformationProvider */]])
    ], PersonalInformationPage);
    return PersonalInformationPage;
}());

//# sourceMappingURL=personal-information.js.map

/***/ }),

/***/ 123:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PlanIlimitadoPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__tabs_tabs__ = __webpack_require__(16);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};



var PlanIlimitadoPage = /** @class */ (function () {
    function PlanIlimitadoPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    PlanIlimitadoPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PlanIlimitadoPage');
    };
    PlanIlimitadoPage.prototype.btnBegin = function () {
        this.navCtrl.setRoot(__WEBPACK_IMPORTED_MODULE_2__tabs_tabs__["a" /* TabsPage */]);
    };
    PlanIlimitadoPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-plan-ilimitado',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/plan-ilimitado/plan-ilimitado.html"*/'<ion-header>\n    <ion-navbar color="bg-alma">\n      <button ion-button menuToggle>\n        <ion-icon name="more"></ion-icon>\n      </button>\n      \n      <ion-buttons end>\n        <button ion-button icon-only  (click)="btnBegin()">\n            <img src="assets/imgs/logo-h.png" width="75" alt="user">\n        </button>\n      </ion-buttons>\n        \n    </ion-navbar>\n  \n  </ion-header>\n\n<ion-content>\n    <ul class="breadcrumb">\n      <li><a href="#">Contratación </a><ion-icon name="arrow-forward" class="icon-breadcrump"></ion-icon></li>\n      <li class="active">Plan Ilimitado</li>\n    </ul>\n\n    <ion-card class="card-alma">\n\n        <ion-card-header>\n            <h1 class="tit"><em><strong>Plan Ilimitado</strong></em></h1>\n        </ion-card-header>\n      \n        <ion-card-content>\n          <!-- Add card content here! -->\n          <ion-grid>\n            <ion-row>\n              <ion-col col-4><button ion-button class="btn-circ-a-badge">IPHONE X</button></ion-col>\n              <ion-col col-4><button ion-button class="btn-circ-a-badge">LG G6</button></ion-col>\n              <ion-col col-4><button ion-button class="btn-circ-a-badge">SAMSUNG S9</button></ion-col>\n            </ion-row>\n            \n          </ion-grid>\n\n          <h2><strong>y llama ilimitadamente</strong><br>\n            Tenemos el mejor Plan para ti</h2>\n\n            <ion-grid>\n              <ion-row>\n                <ion-col col-4>\n                  <img src="assets/imgs/phone.png">\n                  <h3><strong>20Gb 4G</strong><br>\n                    SAMSUNG S9</h3>\n                </ion-col>\n                <ion-col col-8>\n                  Navega y llama  ilimitadamente, tenemos el mejor Plan para ti las primeras 12 Cuotas por:\n                  <span class="tit"><strong>$500</strong></span>\n                      <button ion-button class="btn-circ-a">PIDE TU PLAN</button><br>\n                </ion-col>\n              </ion-row>\n              \n            </ion-grid>\n\n            <h2>ADEMAS TE DAMOS LAS ÚLTIMAS 6 CUOTAS GRATIS</h2>\n          \n        </ion-card-content>\n      \n      </ion-card>\n      \n</ion-content>'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/plan-ilimitado/plan-ilimitado.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], PlanIlimitadoPage);
    return PlanIlimitadoPage;
}());

//# sourceMappingURL=plan-ilimitado.js.map

/***/ }),

/***/ 124:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PlanProUnidosPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__tabs_tabs__ = __webpack_require__(16);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};



var PlanProUnidosPage = /** @class */ (function () {
    function PlanProUnidosPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    PlanProUnidosPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PlanProUnidosPage');
    };
    PlanProUnidosPage.prototype.btnBegin = function () {
        this.navCtrl.setRoot(__WEBPACK_IMPORTED_MODULE_2__tabs_tabs__["a" /* TabsPage */]);
    };
    PlanProUnidosPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-plan-pro-unidos',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/plan-pro-unidos/plan-pro-unidos.html"*/'<ion-header>\n    <ion-navbar color="bg-alma">\n      <button ion-button menuToggle>\n        <ion-icon name="more"></ion-icon>\n      </button>\n      \n      <ion-buttons end>\n        <button ion-button icon-only  (click)="btnBegin()">\n            <img src="assets/imgs/logo-h.png" width="75" alt="user">\n        </button>\n      </ion-buttons>\n        \n    </ion-navbar>\n  \n  </ion-header>\n\n<ion-content>\n    <ul class="breadcrumb">\n      <li><a href="#">Contratación </a><ion-icon name="arrow-forward" class="icon-breadcrump"></ion-icon></li>\n      <li class="active">Plan Pro Unidos</li>\n    </ul>\n\n    <ion-card class="card-alma">\n\n        <ion-card-header>\n            <h1 class="tit"><em><strong>Plan Pro Unidos</strong></em></h1>\n        </ion-card-header>\n      \n        <ion-card-content>\n          <!-- Add card content here! -->\n\n          <h3>¿Cuantas Lineas deseas?</h3>\n\n          <ion-grid>\n              <ion-row>\n\n                <ion-col col-3>\n                    <button ion-button class="btn-circ-a">2</button><br>\n                </ion-col>\n\n                <ion-col col-3>\n                    <button ion-button class="btn-circ-a">3</button><br>\n                </ion-col>\n\n                <ion-col col-3>\n                    <button ion-button class="btn-circ-a">4</button><br>\n                </ion-col>\n\n                <ion-col col-3>\n                    <button ion-button class="btn-circ-a">5</button><br>\n                </ion-col>\n              </ion-row>\n          </ion-grid>\n\n          <h3>Quiero mi Plan por:<strong></strong> </h3>\n          \n          <ion-grid>\n              <ion-row>\n\n                <ion-col col-6>\n                    <button ion-button class="btn-alma">15 Días</button><br>\n                </ion-col>\n\n                <ion-col col-6>\n                    <button ion-button class="btn-alma">30 Días</button><br>\n                </ion-col>\n\n              </ion-row>\n          </ion-grid>\n\n          <span class="tit"><strong>$500</strong></span>\n\n          <ion-grid>\n              <ion-row>\n\n                <ion-col col-2>\n                </ion-col>\n\n                <ion-col col-2>\n                    <img src="assets/imgs/canada.png">\n                </ion-col>\n\n                <ion-col col-2>\n                    <img src="assets/imgs/costarica.png">\n                </ion-col>\n\n                <ion-col col-2>\n                    <img src="assets/imgs/mex.png">\n                </ion-col>\n\n                <ion-col col-2>\n                    <img src="assets/imgs/usa.png">\n                </ion-col>\n\n              </ion-row>\n          </ion-grid>\n          \n          <ion-item>\n              <ion-label>Acepto las condiciones para este plan</ion-label>\n              <ion-checkbox color="bg-n" checked="false"></ion-checkbox>\n          </ion-item>\n\n          \n\n          <button ion-button class="btn-circ-n">PIDE TU PLAN</button><br>\n          \n          \n        </ion-card-content>\n        \n      \n      </ion-card>\n\n\n\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/plan-pro-unidos/plan-pro-unidos.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], PlanProUnidosPage);
    return PlanProUnidosPage;
}());

//# sourceMappingURL=plan-pro-unidos.js.map

/***/ }),

/***/ 125:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PlanProPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__tabs_tabs__ = __webpack_require__(16);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};



var PlanProPage = /** @class */ (function () {
    function PlanProPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    PlanProPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PlanProPage');
    };
    PlanProPage.prototype.btnBegin = function () {
        this.navCtrl.setRoot(__WEBPACK_IMPORTED_MODULE_2__tabs_tabs__["a" /* TabsPage */]);
    };
    PlanProPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-plan-pro',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/plan-pro/plan-pro.html"*/'<ion-header>\n    <ion-navbar color="bg-alma">\n      <button ion-button menuToggle>\n        <ion-icon name="more"></ion-icon>\n      </button>\n      \n      <ion-buttons end>\n        <button ion-button icon-only  (click)="btnBegin()">\n            <img src="assets/imgs/logo-h.png" width="75" alt="user">\n        </button>\n      </ion-buttons>\n        \n    </ion-navbar>\n  \n  </ion-header>\n\n<ion-content>\n    <ul class="breadcrumb">\n      <li><a href="#">Contratación </a><ion-icon name="arrow-forward" class="icon-breadcrump"></ion-icon></li>\n      <li class="active">Plan Pro</li>\n    </ul>\n\n    <ion-card class="card-alma">\n\n        <ion-card-header>\n            <h1 class="tit"><em><strong>Plan Pro</strong></em></h1>\n        </ion-card-header>\n      \n        <ion-card-content>\n          <!-- Add card content here! -->\n          \n          <p>Por la cantidad de días que necesites, Portate a Alma y obten el mejor Plan para tu familia <strong>¿Que esperas?</strong> </p>\n        \n          <h3>Quiero mi Plan por:</h3>\n          \n          <ion-grid>\n              <ion-row>\n\n                <ion-col col-6>\n                    <button ion-button class="cta-naranjo">15 Días</button><br>\n                </ion-col>\n\n                <ion-col col-6>\n                    <button ion-button class="cta-naranjo">30 Días</button><br>\n                </ion-col>\n\n              </ion-row>\n          </ion-grid>\n\n          <span class="tit"><strong>$500</strong></span>\n          \n          <button ion-button class="btn-circ-n">PIDE TU PLAN</button><br>\n\n        </ion-card-content>\n      \n      </ion-card>\n      \n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/plan-pro/plan-pro.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], PlanProPage);
    return PlanProPage;
}());

//# sourceMappingURL=plan-pro.js.map

/***/ }),

/***/ 126:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PlansPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__plan_pro_plan_pro__ = __webpack_require__(125);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__plan_ilimitado_plan_ilimitado__ = __webpack_require__(123);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__plan_pro_unidos_plan_pro_unidos__ = __webpack_require__(124);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__tabs_tabs__ = __webpack_require__(16);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};






var PlansPage = /** @class */ (function () {
    function PlansPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    PlansPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PlansPage');
    };
    PlansPage.prototype.btnBegin = function () {
        this.navCtrl.setRoot(__WEBPACK_IMPORTED_MODULE_5__tabs_tabs__["a" /* TabsPage */]);
    };
    PlansPage.prototype.btnPlanPro = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_2__plan_pro_plan_pro__["a" /* PlanProPage */], {});
    };
    PlansPage.prototype.btnPlanProUnidos = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_4__plan_pro_unidos_plan_pro_unidos__["a" /* PlanProUnidosPage */], {});
    };
    PlansPage.prototype.btnPlanIlimitado = function () {
        this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_3__plan_ilimitado_plan_ilimitado__["a" /* PlanIlimitadoPage */], {});
    };
    PlansPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-plans',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/plans/plans.html"*/'<ion-header>\n  <ion-navbar color="bg-alma">\n    <button ion-button menuToggle>\n      <ion-icon name="more"></ion-icon>\n    </button>\n    \n    <ion-buttons end>\n      <button ion-button icon-only  (click)="btnBegin()">\n          <img src="assets/imgs/logo-h.png" width="75" alt="user">\n      </button>\n    </ion-buttons>\n      \n  </ion-navbar>\n  \n</ion-header>\n\n<ion-content>\n    <ul class="breadcrumb">\n      <li><a href="#">Contratación </a><ion-icon name="arrow-forward" class="icon-breadcrump"></ion-icon></li>\n      <li class="active">Planes</li>\n    </ul>\n\n    <ion-card class="card-alma">\n\n        <ion-card-header>\n            <h1 class="tit"><em><strong>Pide tu Plan</strong></em></h1>\n        </ion-card-header>\n        \n      \n        <ion-card-content>\n          <!-- Add card content here! -->\n          <button (click)="btnPlanPro()" ion-button class="btn-circ-n">PLAN PRO</button><br>\n          <button (click)="btnPlanProUnidos()" ion-button class="btn-circ-n">PLAN PRO UNIDOS</button><br>\n          <button (click)="btnPlanIlimitado()" ion-button class="btn-circ-n">PLAN ILIMITADO</button>\n        </ion-card-content>\n\n        <p>Por que sabemos que necesitas el mejor plan, elige el que mas te guste!</p>\n      \n      </ion-card>\n\n\n\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/plans/plans.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], PlansPage);
    return PlansPage;
}());

//# sourceMappingURL=plans.js.map

/***/ }),

/***/ 137:
/***/ (function(module, exports) {

function webpackEmptyAsyncContext(req) {
	// Here Promise.resolve().then() is used instead of new Promise() to prevent
	// uncatched exception popping up in devtools
	return Promise.resolve().then(function() {
		throw new Error("Cannot find module '" + req + "'.");
	});
}
webpackEmptyAsyncContext.keys = function() { return []; };
webpackEmptyAsyncContext.resolve = webpackEmptyAsyncContext;
module.exports = webpackEmptyAsyncContext;
webpackEmptyAsyncContext.id = 137;

/***/ }),

/***/ 16:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return TabsPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__ionic_storage__ = __webpack_require__(28);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__invoices_invoices__ = __webpack_require__(111);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__consumption_consumption__ = __webpack_require__(109);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__help_help__ = __webpack_require__(110);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__providers_subscriber_information_subscriber_information__ = __webpack_require__(87);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};







var TabsPage = /** @class */ (function () {
    function TabsPage(navCtrl, navParams, storage, subscriberInformationProvider) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        this.storage = storage;
        this.subscriberInformationProvider = subscriberInformationProvider;
        this.name = 'B';
        //name:any;
        this.lista = [];
        this.tab1Root = __WEBPACK_IMPORTED_MODULE_3__invoices_invoices__["a" /* InvoicesPage */];
        this.tab2Root = __WEBPACK_IMPORTED_MODULE_4__consumption_consumption__["a" /* ConsumptionPage */];
        this.tab3Root = __WEBPACK_IMPORTED_MODULE_5__help_help__["a" /* HelpPage */];
        this.myIndex = navParams.data.tabIndex || 0;
        //this.typeClient(4);
        this.getidSubscriberType();
    }
    TabsPage.prototype.getidSubscriberType = function () {
        var _this = this;
        this.storage.get('idSubscriberType').then(function (val) {
            console.log('idSubscriberType', val);
            _this.typeClient(val);
        });
    };
    TabsPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad TabsPage');
    };
    TabsPage.prototype.typeClient = function (idSubscriberType) {
        console.log("idSubscriberType: " + idSubscriberType);
        switch (idSubscriberType) {
            case 1:
                console.log("Case 1");
                this.name = "Boleta";
                break;
            case 2:
                console.log("Case 2");
                this.name = "Boleta";
                break;
            case 3:
                console.log("Case 3");
                this.name = "Saldo";
                break;
            case 4:
                console.log("Case 4");
                this.name = "Saldo";
                break;
            default:
                break;
        }
    };
    TabsPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-tabs',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/tabs/tabs.html"*/'<ion-tabs>   \n  <ion-tab tabTitle="{{name}}" tabIcon="megaphone" [root]="tab1Root"></ion-tab>\n  <ion-tab tabTitle="Consumo"  tabIcon="cog"       [root]="tab2Root"></ion-tab>\n  <ion-tab tabTitle="Ayuda"    tabIcon="help"      [root]="tab3Root"></ion-tab>  \n</ion-tabs>'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/tabs/tabs.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */],
            __WEBPACK_IMPORTED_MODULE_2__ionic_storage__["b" /* Storage */],
            __WEBPACK_IMPORTED_MODULE_6__providers_subscriber_information_subscriber_information__["a" /* SubscriberInformationProvider */]])
    ], TabsPage);
    return TabsPage;
}());

//# sourceMappingURL=tabs.js.map

/***/ }),

/***/ 179:
/***/ (function(module, exports, __webpack_require__) {

var map = {
	"../pages/acerca/acerca.module": [
		309,
		21
	],
	"../pages/consumption/consumption.module": [
		310,
		20
	],
	"../pages/help/help.module": [
		311,
		19
	],
	"../pages/invoices/invoices.module": [
		312,
		18
	],
	"../pages/line-status/line-status.module": [
		313,
		17
	],
	"../pages/login-access/login-access.module": [
		314,
		16
	],
	"../pages/login-check/login-check.module": [
		315,
		15
	],
	"../pages/login/login.module": [
		316,
		14
	],
	"../pages/personal-address/personal-address.module": [
		317,
		13
	],
	"../pages/personal-information/personal-information.module": [
		318,
		12
	],
	"../pages/plan-ilimitado/plan-ilimitado.module": [
		319,
		11
	],
	"../pages/plan-pro-unidos/plan-pro-unidos.module": [
		320,
		10
	],
	"../pages/plan-pro/plan-pro.module": [
		321,
		9
	],
	"../pages/plans/plans.module": [
		322,
		8
	],
	"../pages/public-plan-ilimitado/public-plan-ilimitado.module": [
		323,
		7
	],
	"../pages/public-plan-pro-unidos/public-plan-pro-unidos.module": [
		324,
		6
	],
	"../pages/public-plan-pro/public-plan-pro.module": [
		325,
		5
	],
	"../pages/public-plans/public-plans.module": [
		326,
		4
	],
	"../pages/register-add-code/register-add-code.module": [
		327,
		3
	],
	"../pages/register-address/register-address.module": [
		328,
		2
	],
	"../pages/register/register.module": [
		329,
		1
	],
	"../pages/tabs/tabs.module": [
		330,
		0
	]
};
function webpackAsyncContext(req) {
	var ids = map[req];
	if(!ids)
		return Promise.reject(new Error("Cannot find module '" + req + "'."));
	return __webpack_require__.e(ids[1]).then(function() {
		return __webpack_require__(ids[0]);
	});
};
webpackAsyncContext.keys = function webpackAsyncContextKeys() {
	return Object.keys(map);
};
webpackAsyncContext.id = 179;
module.exports = webpackAsyncContext;

/***/ }),

/***/ 180:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return ConsumptionProvider; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_common_http__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__config_api_js__ = __webpack_require__(36);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__ = __webpack_require__(37);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};





var ConsumptionProvider = /** @class */ (function () {
    function ConsumptionProvider(httpClient, platform, http) {
        this.httpClient = httpClient;
        this.platform = platform;
        this.http = http;
        console.log('ConsumptionProvider Provider');
    }
    ConsumptionProvider.prototype.getConsumption = function (tokenParam, nPhone) {
        var _this = this;
        var developerMode = "" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].enviroment;
        if (this.isDeveloper(developerMode)) {
            console.log("MODE " + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].enviroment);
            return new Promise(function (resolve) {
                _this.httpClient.get(__WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + "portal/getConsumptionsByTelephoneNumber/" + nPhone + "/" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].operator, { headers: { 'token': tokenParam } }).subscribe(function (data) {
                    resolve(data);
                }, function (err) {
                    console.log("* Error getConsumption() *");
                    console.log(err);
                });
            });
        }
        else {
            console.log("MODE " + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].enviroment);
            return this.platform.ready().then(function () {
                return _this.http.get(__WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + "portal/getConsumptionsByTelephoneNumber/" + nPhone + "/" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].operator, {}, { 'token': tokenParam });
            });
        }
    };
    ConsumptionProvider.prototype.isDeveloper = function (mode) {
        var isDev = false;
        if (mode == 'dev') {
            return isDev = true;
        }
        return isDev;
    };
    ConsumptionProvider = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["A" /* Injectable */])(),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_0__angular_common_http__["a" /* HttpClient */],
            __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["k" /* Platform */],
            __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__["a" /* HTTP */]])
    ], ConsumptionProvider);
    return ConsumptionProvider;
}());

//# sourceMappingURL=consumption.js.map

/***/ }),

/***/ 183:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return LoginProvider; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_common_http__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__config_api_js__ = __webpack_require__(36);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__ = __webpack_require__(37);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};





/*
  Generated class for the LoginProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
var LoginProvider = /** @class */ (function () {
    function LoginProvider(httpClient, loadingController, http, platform) {
        this.httpClient = httpClient;
        this.loadingController = loadingController;
        this.http = http;
        this.platform = platform;
        console.log('Hello LoginProvider Provider');
    }
    LoginProvider.prototype.login = function (phoneNumber, code) {
        var _this = this;
        var developerMode = "" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].enviroment;
        var Loginresponse;
        var showLoadind = this.loadingController.create({
            content: "Cargando datos"
        });
        showLoadind.present();
        if (this.isDeveloper(developerMode)) {
            console.log("MODE DEVELOPER");
            return new Promise(function (resolve) {
                console.log("BASE URL Login " + ("" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].authenticator));
                _this.httpClient.
                    get("" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].authenticator + "/login/" + phoneNumber + "/", {
                    headers: { 'code': code }
                }).subscribe(function (data) {
                    resolve(data);
                    showLoadind.dismiss();
                }, function (err) {
                    console.log("* Error Login() *");
                    console.log(err);
                    showLoadind.dismiss();
                });
            });
        }
        else {
            console.log("MODE PRODUCTION");
            return this.platform.ready().then(function () {
                showLoadind.dismiss();
                return _this.http.get("" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].authenticator + "/login/" + phoneNumber + "/", {}, { 'code': code });
            });
        }
    };
    LoginProvider.prototype.isDeveloper = function (mode) {
        var isDev = false;
        if (mode == 'dev') {
            return isDev = true;
        }
        return isDev;
    };
    LoginProvider = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["A" /* Injectable */])(),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_0__angular_common_http__["a" /* HttpClient */],
            __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["f" /* LoadingController */],
            __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__["a" /* HTTP */], __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["k" /* Platform */]])
    ], LoginProvider);
    return LoginProvider;
}());

//# sourceMappingURL=login.js.map

/***/ }),

/***/ 184:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return GenerateCodeProvider; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_common_http__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__config_api_js__ = __webpack_require__(36);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};




/*
  Generated class for the GenerateCodeProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
var GenerateCodeProvider = /** @class */ (function () {
    function GenerateCodeProvider(httpClient, loadingController, alertController) {
        this.httpClient = httpClient;
        this.loadingController = loadingController;
        this.alertController = alertController;
        console.log('Hello GenerateCodeProvider Provider');
    }
    GenerateCodeProvider.prototype.createVerificationCode = function (phoneNumber) {
        var _this = this;
        var showLoadind = this.loadingController.create({
            content: "Cargando datos"
        });
        showLoadind.present();
        return new Promise(function (resolve) {
            console.log("BASE URL createVerificationCode " + ("" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].authenticator));
            _this.httpClient.
                get("" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].authenticator + "/createVerificationCode/" + phoneNumber + "/ESMERO").subscribe(function (data) {
                resolve(data);
                showLoadind.dismiss();
            }, function (err) {
                console.log(err);
                _this.errorCod = err["error"]["code"];
                _this.presentAlert(_this.errorCod);
                showLoadind.dismiss();
            });
        });
    };
    GenerateCodeProvider.prototype.presentAlert = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var alert, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = code;
                        switch (_a) {
                            case 401: return [3 /*break*/, 1];
                        }
                        return [3 /*break*/, 4];
                    case 1: return [4 /*yield*/, this.alertController.create({
                            message: 'Número no se encuentra registrado.',
                            buttons: ['OK']
                        })];
                    case 2:
                        alert = _b.sent();
                        return [4 /*yield*/, alert.present()];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 4: return [4 /*yield*/, this.alertController.create({
                            message: 'Lo sentimos estamos teniendo problemas de conexión.',
                            buttons: ['OK']
                        })];
                    case 5:
                        alert = _b.sent();
                        return [4 /*yield*/, alert.present()];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    GenerateCodeProvider = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["A" /* Injectable */])(),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_0__angular_common_http__["a" /* HttpClient */],
            __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["f" /* LoadingController */],
            __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["a" /* AlertController */]])
    ], GenerateCodeProvider);
    return GenerateCodeProvider;
}());

//# sourceMappingURL=generate-code.js.map

/***/ }),

/***/ 185:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PersonalInformationProvider; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_common_http__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(4);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};



var PersonalInformationProvider = /** @class */ (function () {
    function PersonalInformationProvider(httpClient, loadingController) {
        this.httpClient = httpClient;
        this.loadingController = loadingController;
        console.log('Hello PersonalInformationProvider Provider');
    }
    PersonalInformationProvider.prototype.getPersonalInformation = function () {
        var _this = this;
        var showLoadind = this.loadingController.create({
            content: "Cargando datos"
        });
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
        return new Promise(function (resolve) {
            _this.httpClient.get("http://192.168.119.84:16080/MobileEndPoint/api/portal/getSubscriberInformation/75663344/ESMERO", {
                headers: { 'token': 'NzU2NjMzNDQ7M2ZhYTYyZjktNDBiZC00NzIwLWE4YjAtOGJjNDM3YjAzYzBl' }
            }).subscribe(function (data) {
                resolve(data);
                showLoadind.dismiss();
            }, function (err) {
                console.log("* Error getPersonalInformation() *");
                console.log(err);
                showLoadind.dismiss();
            });
        });
    };
    PersonalInformationProvider = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["A" /* Injectable */])(),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_0__angular_common_http__["a" /* HttpClient */], __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["f" /* LoadingController */]])
    ], PersonalInformationProvider);
    return PersonalInformationProvider;
}());

//# sourceMappingURL=personal-information.js.map

/***/ }),

/***/ 227:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return CloseSessionProvider; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_common_http__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__config_api_js__ = __webpack_require__(36);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__ = __webpack_require__(37);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__ionic_storage__ = __webpack_require__(28);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};






/*
  Generated class for the CloseSessionProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
var CloseSessionProvider = /** @class */ (function () {
    function CloseSessionProvider(httpClient, http, storage, platform) {
        this.httpClient = httpClient;
        this.http = http;
        this.storage = storage;
        this.platform = platform;
        console.log('Hello CloseSessionProvider Provider');
    }
    CloseSessionProvider.prototype.logOut = function (storageResponse) {
        var _this = this;
        var developerMode = "" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].enviroment;
        var phoneNumber = storageResponse[1];
        if (this.isDeveloper(developerMode)) {
            console.log("MODE DEVELOPER");
            return new Promise(function (resolve) {
                console.log("BASE URL Login " + ("" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].authenticator));
                _this.httpClient.
                    get("" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].authenticator + "/logOut/" + phoneNumber + "/", {
                    headers: { 'token': storageResponse[0] }
                }).subscribe(function (data) {
                    resolve(data);
                }, function (err) {
                    console.log("* Error Login() *");
                    console.log(err);
                });
            });
        }
        else {
            console.log("MODE PRODUCTION");
            return this.platform.ready().then(function () {
                return _this.http.get("" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].authenticator + "/logOut/" + phoneNumber + "/", {}, { 'token': storageResponse[0] });
            });
        }
    };
    CloseSessionProvider.prototype.isDeveloper = function (mode) {
        var isDev = false;
        if (mode == 'dev') {
            return isDev = true;
        }
        return isDev;
    };
    CloseSessionProvider = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["A" /* Injectable */])(),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_0__angular_common_http__["a" /* HttpClient */],
            __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__["a" /* HTTP */],
            __WEBPACK_IMPORTED_MODULE_5__ionic_storage__["b" /* Storage */],
            __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["k" /* Platform */]])
    ], CloseSessionProvider);
    return CloseSessionProvider;
}());

//# sourceMappingURL=close-session.js.map

/***/ }),

/***/ 228:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return AcercaPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};


/**
 * Generated class for the AcercaPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */
var AcercaPage = /** @class */ (function () {
    function AcercaPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    AcercaPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad AcercaPage');
    };
    AcercaPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-acerca',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/acerca/acerca.html"*/'<!--\n  Generated template for the AcercaPage page.\n\n  See http://ionicframework.com/docs/components/#navigation for more info on\n  Ionic pages and navigation.\n-->\n<ion-header>\n  <ion-navbar>\n    <button ion-button menuToggle>\n      <ion-icon name="menu"></ion-icon>\n    </button>\n    <ion-title>Acerca</ion-title>\n  </ion-navbar>\n</ion-header>\n\n<ion-content padding>\n\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/acerca/acerca.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], AcercaPage);
    return AcercaPage;
}());

//# sourceMappingURL=acerca.js.map

/***/ }),

/***/ 229:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PersonalAddressPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};


var PersonalAddressPage = /** @class */ (function () {
    function PersonalAddressPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
    }
    PersonalAddressPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad PersonalAddressPage');
    };
    PersonalAddressPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-personal-address',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/personal-address/personal-address.html"*/'<!--\n  Generated template for the PersonalAddressPage page.\n\n  See http://ionicframework.com/docs/components/#navigation for more info on\n  Ionic pages and navigation.\n-->\n<ion-header>\n  <ion-navbar>\n    <ion-title>personalAddress</ion-title>\n  </ion-navbar>\n</ion-header>\n\n<ion-content padding>\n\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/personal-address/personal-address.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], PersonalAddressPage);
    return PersonalAddressPage;
}());

//# sourceMappingURL=personal-address.js.map

/***/ }),

/***/ 230:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_platform_browser_dynamic__ = __webpack_require__(231);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__app_module__ = __webpack_require__(251);


Object(__WEBPACK_IMPORTED_MODULE_0__angular_platform_browser_dynamic__["a" /* platformBrowserDynamic */])().bootstrapModule(__WEBPACK_IMPORTED_MODULE_1__app_module__["a" /* AppModule */]);
//# sourceMappingURL=main.js.map

/***/ }),

/***/ 251:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return AppModule; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_platform_browser__ = __webpack_require__(34);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__app_component__ = __webpack_require__(306);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__pages_home_home__ = __webpack_require__(307);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__pages_list_list__ = __webpack_require__(308);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__ionic_native_status_bar__ = __webpack_require__(225);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__ionic_native_splash_screen__ = __webpack_require__(226);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8__ionic_storage__ = __webpack_require__(28);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__pages_login_login__ = __webpack_require__(114);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10__pages_login_check_login_check__ = __webpack_require__(46);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_11__pages_login_access_login_access__ = __webpack_require__(113);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_12__pages_acerca_acerca__ = __webpack_require__(228);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_13__pages_tabs_tabs__ = __webpack_require__(16);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_14__pages_register_register__ = __webpack_require__(115);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_15__pages_register_address_register_address__ = __webpack_require__(116);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_16__pages_register_add_code_register_add_code__ = __webpack_require__(117);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_17__pages_consumption_consumption__ = __webpack_require__(109);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_18__pages_invoices_invoices__ = __webpack_require__(111);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_19__pages_help_help__ = __webpack_require__(110);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_20__pages_plans_plans__ = __webpack_require__(126);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_21__pages_plan_pro_plan_pro__ = __webpack_require__(125);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_22__pages_plan_ilimitado_plan_ilimitado__ = __webpack_require__(123);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_23__pages_personal_address_personal_address__ = __webpack_require__(229);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_24__pages_plan_pro_unidos_plan_pro_unidos__ = __webpack_require__(124);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_25__pages_line_status_line_status__ = __webpack_require__(112);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_26__providers_consumption_consumption__ = __webpack_require__(180);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_27__angular_common_http__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_28__pages_personal_information_personal_information__ = __webpack_require__(122);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_29__providers_personal_information_personal_information__ = __webpack_require__(185);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_30__providers_generate_code_generate_code__ = __webpack_require__(184);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_31__providers_subscriber_information_subscriber_information__ = __webpack_require__(87);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_32__providers_login_login__ = __webpack_require__(183);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_33__ionic_native_http__ = __webpack_require__(37);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_34__providers_close_session_close_session__ = __webpack_require__(227);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_35__pages_public_plans_public_plans__ = __webpack_require__(118);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_36__pages_public_plan_pro_public_plan_pro__ = __webpack_require__(119);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_37__pages_public_plan_ilimitado_public_plan_ilimitado__ = __webpack_require__(120);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_38__pages_public_plan_pro_unidos_public_plan_pro_unidos__ = __webpack_require__(121);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_39__providers_plans_plans__ = __webpack_require__(52);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};








































var AppModule = /** @class */ (function () {
    function AppModule() {
    }
    AppModule = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["I" /* NgModule */])({
            declarations: [
                __WEBPACK_IMPORTED_MODULE_12__pages_acerca_acerca__["a" /* AcercaPage */],
                __WEBPACK_IMPORTED_MODULE_17__pages_consumption_consumption__["a" /* ConsumptionPage */],
                __WEBPACK_IMPORTED_MODULE_18__pages_invoices_invoices__["a" /* InvoicesPage */],
                __WEBPACK_IMPORTED_MODULE_13__pages_tabs_tabs__["a" /* TabsPage */],
                __WEBPACK_IMPORTED_MODULE_19__pages_help_help__["a" /* HelpPage */],
                __WEBPACK_IMPORTED_MODULE_3__app_component__["a" /* MyApp */],
                __WEBPACK_IMPORTED_MODULE_4__pages_home_home__["a" /* HomePage */],
                __WEBPACK_IMPORTED_MODULE_5__pages_list_list__["a" /* ListPage */],
                __WEBPACK_IMPORTED_MODULE_9__pages_login_login__["a" /* LoginPage */],
                __WEBPACK_IMPORTED_MODULE_10__pages_login_check_login_check__["a" /* LoginCheckPage */],
                __WEBPACK_IMPORTED_MODULE_11__pages_login_access_login_access__["a" /* LoginAccessPage */],
                __WEBPACK_IMPORTED_MODULE_14__pages_register_register__["a" /* RegisterPage */],
                __WEBPACK_IMPORTED_MODULE_15__pages_register_address_register_address__["a" /* RegisterAddressPage */],
                __WEBPACK_IMPORTED_MODULE_20__pages_plans_plans__["a" /* PlansPage */],
                __WEBPACK_IMPORTED_MODULE_21__pages_plan_pro_plan_pro__["a" /* PlanProPage */],
                __WEBPACK_IMPORTED_MODULE_22__pages_plan_ilimitado_plan_ilimitado__["a" /* PlanIlimitadoPage */],
                __WEBPACK_IMPORTED_MODULE_23__pages_personal_address_personal_address__["a" /* PersonalAddressPage */],
                __WEBPACK_IMPORTED_MODULE_16__pages_register_add_code_register_add_code__["a" /* RegisterAddCodePage */],
                __WEBPACK_IMPORTED_MODULE_24__pages_plan_pro_unidos_plan_pro_unidos__["a" /* PlanProUnidosPage */],
                __WEBPACK_IMPORTED_MODULE_25__pages_line_status_line_status__["a" /* LineStatusPage */],
                __WEBPACK_IMPORTED_MODULE_28__pages_personal_information_personal_information__["a" /* PersonalInformationPage */],
                __WEBPACK_IMPORTED_MODULE_35__pages_public_plans_public_plans__["a" /* PublicPlansPage */],
                __WEBPACK_IMPORTED_MODULE_36__pages_public_plan_pro_public_plan_pro__["a" /* PublicPlanProPage */],
                __WEBPACK_IMPORTED_MODULE_37__pages_public_plan_ilimitado_public_plan_ilimitado__["a" /* PublicPlanIlimitadoPage */],
                __WEBPACK_IMPORTED_MODULE_38__pages_public_plan_pro_unidos_public_plan_pro_unidos__["a" /* PublicPlanProUnidosPage */]
            ],
            imports: [
                __WEBPACK_IMPORTED_MODULE_0__angular_platform_browser__["a" /* BrowserModule */],
                __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["d" /* IonicModule */].forRoot(__WEBPACK_IMPORTED_MODULE_3__app_component__["a" /* MyApp */], {}, {
                    links: [
                        { loadChildren: '../pages/acerca/acerca.module#AcercaPageModule', name: 'AcercaPage', segment: 'acerca', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/consumption/consumption.module#ConsumptionPageModule', name: 'ConsumptionPage', segment: 'consumption', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/help/help.module#HelpPageModule', name: 'HelpPage', segment: 'help', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/invoices/invoices.module#InvoicesPageModule', name: 'InvoicesPage', segment: 'invoices', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/line-status/line-status.module#LineStatusPageModule', name: 'LineStatusPage', segment: 'line-status', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/login-access/login-access.module#LoginAccessPageModule', name: 'LoginAccessPage', segment: 'login-access', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/login-check/login-check.module#LoginCheckPageModule', name: 'LoginCheckPage', segment: 'login-check', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/login/login.module#LoginPageModule', name: 'LoginPage', segment: 'login', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/personal-address/personal-address.module#PersonalAddressPageModule', name: 'PersonalAddressPage', segment: 'personal-address', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/personal-information/personal-information.module#PersonalInformationPageModule', name: 'PersonalInformationPage', segment: 'personal-information', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/plan-ilimitado/plan-ilimitado.module#PlanIlimitadoPageModule', name: 'PlanIlimitadoPage', segment: 'plan-ilimitado', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/plan-pro-unidos/plan-pro-unidos.module#PlanProUnidosPageModule', name: 'PlanProUnidosPage', segment: 'plan-pro-unidos', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/plan-pro/plan-pro.module#PlanProPageModule', name: 'PlanProPage', segment: 'plan-pro', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/plans/plans.module#PlansPageModule', name: 'PlansPage', segment: 'plans', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/public-plan-ilimitado/public-plan-ilimitado.module#PublicPlanIlimitadoPageModule', name: 'PublicPlanIlimitadoPage', segment: 'public-plan-ilimitado', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/public-plan-pro-unidos/public-plan-pro-unidos.module#PublicPlanProUnidosPageModule', name: 'PublicPlanProUnidosPage', segment: 'public-plan-pro-unidos', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/public-plan-pro/public-plan-pro.module#PublicPlanProPageModule', name: 'PublicPlanProPage', segment: 'public-plan-pro', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/public-plans/public-plans.module#PublicPlansPageModule', name: 'PublicPlansPage', segment: 'public-plans', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/register-add-code/register-add-code.module#RegisterAddCodePageModule', name: 'RegisterAddCodePage', segment: 'register-add-code', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/register-address/register-address.module#RegisterAddressPageModule', name: 'RegisterAddressPage', segment: 'register-address', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/register/register.module#RegisterPageModule', name: 'RegisterPage', segment: 'register', priority: 'low', defaultHistory: [] },
                        { loadChildren: '../pages/tabs/tabs.module#TabsPageModule', name: 'TabsPage', segment: 'tabs', priority: 'low', defaultHistory: [] }
                    ]
                }),
                __WEBPACK_IMPORTED_MODULE_27__angular_common_http__["b" /* HttpClientModule */],
                __WEBPACK_IMPORTED_MODULE_8__ionic_storage__["a" /* IonicStorageModule */].forRoot()
            ],
            bootstrap: [__WEBPACK_IMPORTED_MODULE_2_ionic_angular__["b" /* IonicApp */]],
            entryComponents: [
                __WEBPACK_IMPORTED_MODULE_12__pages_acerca_acerca__["a" /* AcercaPage */],
                __WEBPACK_IMPORTED_MODULE_17__pages_consumption_consumption__["a" /* ConsumptionPage */],
                __WEBPACK_IMPORTED_MODULE_18__pages_invoices_invoices__["a" /* InvoicesPage */],
                __WEBPACK_IMPORTED_MODULE_13__pages_tabs_tabs__["a" /* TabsPage */],
                __WEBPACK_IMPORTED_MODULE_19__pages_help_help__["a" /* HelpPage */],
                __WEBPACK_IMPORTED_MODULE_3__app_component__["a" /* MyApp */],
                __WEBPACK_IMPORTED_MODULE_4__pages_home_home__["a" /* HomePage */],
                __WEBPACK_IMPORTED_MODULE_5__pages_list_list__["a" /* ListPage */],
                __WEBPACK_IMPORTED_MODULE_9__pages_login_login__["a" /* LoginPage */],
                __WEBPACK_IMPORTED_MODULE_10__pages_login_check_login_check__["a" /* LoginCheckPage */],
                __WEBPACK_IMPORTED_MODULE_11__pages_login_access_login_access__["a" /* LoginAccessPage */],
                __WEBPACK_IMPORTED_MODULE_14__pages_register_register__["a" /* RegisterPage */],
                __WEBPACK_IMPORTED_MODULE_15__pages_register_address_register_address__["a" /* RegisterAddressPage */],
                __WEBPACK_IMPORTED_MODULE_20__pages_plans_plans__["a" /* PlansPage */],
                __WEBPACK_IMPORTED_MODULE_21__pages_plan_pro_plan_pro__["a" /* PlanProPage */],
                __WEBPACK_IMPORTED_MODULE_22__pages_plan_ilimitado_plan_ilimitado__["a" /* PlanIlimitadoPage */],
                __WEBPACK_IMPORTED_MODULE_23__pages_personal_address_personal_address__["a" /* PersonalAddressPage */],
                __WEBPACK_IMPORTED_MODULE_16__pages_register_add_code_register_add_code__["a" /* RegisterAddCodePage */],
                __WEBPACK_IMPORTED_MODULE_24__pages_plan_pro_unidos_plan_pro_unidos__["a" /* PlanProUnidosPage */],
                __WEBPACK_IMPORTED_MODULE_25__pages_line_status_line_status__["a" /* LineStatusPage */],
                __WEBPACK_IMPORTED_MODULE_28__pages_personal_information_personal_information__["a" /* PersonalInformationPage */],
                __WEBPACK_IMPORTED_MODULE_35__pages_public_plans_public_plans__["a" /* PublicPlansPage */],
                __WEBPACK_IMPORTED_MODULE_36__pages_public_plan_pro_public_plan_pro__["a" /* PublicPlanProPage */],
                __WEBPACK_IMPORTED_MODULE_37__pages_public_plan_ilimitado_public_plan_ilimitado__["a" /* PublicPlanIlimitadoPage */],
                __WEBPACK_IMPORTED_MODULE_38__pages_public_plan_pro_unidos_public_plan_pro_unidos__["a" /* PublicPlanProUnidosPage */]
            ],
            providers: [
                __WEBPACK_IMPORTED_MODULE_6__ionic_native_status_bar__["a" /* StatusBar */],
                __WEBPACK_IMPORTED_MODULE_7__ionic_native_splash_screen__["a" /* SplashScreen */],
                { provide: __WEBPACK_IMPORTED_MODULE_1__angular_core__["u" /* ErrorHandler */], useClass: __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["c" /* IonicErrorHandler */] },
                __WEBPACK_IMPORTED_MODULE_26__providers_consumption_consumption__["a" /* ConsumptionProvider */],
                __WEBPACK_IMPORTED_MODULE_27__angular_common_http__["b" /* HttpClientModule */],
                __WEBPACK_IMPORTED_MODULE_29__providers_personal_information_personal_information__["a" /* PersonalInformationProvider */],
                __WEBPACK_IMPORTED_MODULE_30__providers_generate_code_generate_code__["a" /* GenerateCodeProvider */],
                __WEBPACK_IMPORTED_MODULE_31__providers_subscriber_information_subscriber_information__["a" /* SubscriberInformationProvider */],
                __WEBPACK_IMPORTED_MODULE_32__providers_login_login__["a" /* LoginProvider */],
                __WEBPACK_IMPORTED_MODULE_33__ionic_native_http__["a" /* HTTP */],
                __WEBPACK_IMPORTED_MODULE_34__providers_close_session_close_session__["a" /* CloseSessionProvider */],
                __WEBPACK_IMPORTED_MODULE_39__providers_plans_plans__["a" /* PlansProvider */],
            ]
        })
    ], AppModule);
    return AppModule;
}());

//# sourceMappingURL=app.module.js.map

/***/ }),

/***/ 306:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return MyApp; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__ionic_native_status_bar__ = __webpack_require__(225);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__ionic_storage__ = __webpack_require__(28);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__ionic_native_splash_screen__ = __webpack_require__(226);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__pages_login_login__ = __webpack_require__(114);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__pages_plans_plans__ = __webpack_require__(126);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__pages_line_status_line_status__ = __webpack_require__(112);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8__pages_personal_information_personal_information__ = __webpack_require__(122);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__providers_subscriber_information_subscriber_information__ = __webpack_require__(87);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_10__providers_close_session_close_session__ = __webpack_require__(227);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};











var MyApp = /** @class */ (function () {
    function MyApp(platform, statusBar, splashScreen, storage, subscriberInformationProvider, closeSessionProvider, loadingController, alertController) {
        this.storage = storage;
        this.subscriberInformationProvider = subscriberInformationProvider;
        this.closeSessionProvider = closeSessionProvider;
        this.loadingController = loadingController;
        this.alertController = alertController;
        //rootPage:any = TabsPage;
        this.rootPage = __WEBPACK_IMPORTED_MODULE_5__pages_login_login__["a" /* LoginPage */];
        //SubscriberInformationProvider
        this.pages = [
            { title: 'Contratación', name: 'PlansPage', component: __WEBPACK_IMPORTED_MODULE_6__pages_plans_plans__["a" /* PlansPage */], icon: 'stats' },
            { title: 'Mis datos', name: 'PersonalInformationPage', component: __WEBPACK_IMPORTED_MODULE_8__pages_personal_information_personal_information__["a" /* PersonalInformationPage */], icon: 'card' },
            { title: 'Mis Gestiones', name: 'LineStatusPage', component: __WEBPACK_IMPORTED_MODULE_7__pages_line_status_line_status__["a" /* LineStatusPage */], icon: 'briefcase' },
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
        this.loggedOutPages = [
            { title: 'Soporte', name: 'SupportPage', component: __WEBPACK_IMPORTED_MODULE_5__pages_login_login__["a" /* LoginPage */], icon: 'help' }
        ];
        this.lista = [];
        platform.ready().then(function () {
            // Okay, so the platform is ready and our plugins are available.
            // Here you can do any higher level native things you might need.
            statusBar.styleDefault();
            splashScreen.hide();
        });
        //this.getSubscriberInformation();
        this.getTokenDatos();
    }
    MyApp.prototype.getTokenDatos = function () {
        var _this = this;
        Promise.all([this.storage.get("authcToken"), this.storage.get("numberPhone")]).then(function (values) {
            console.log("Valor app.component authcToken " + values[0]);
            console.log("Valor app.component numberPhone " + values[1]);
            //this.getSubscriberInformation(values[0],values[1]); 
            _this.subscriberInformationProvider.getData2();
        });
    };
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
    MyApp.prototype.openPage = function (page) {
        var params = {};
        // The index is equal to the order of our tabs inside tabs.ts
        if (page.index) {
            params = { tabIndex: page.index };
        }
        // If tabs page is already active just change the tab index
        if (this.nav.getActiveChildNavs().length && page.index != undefined) {
            this.nav.getActiveChildNavs()[0].select(page.index);
        }
        else {
            // Tabs are not active, so reset the root page 
            // In this case: moving to or from SpecialPage
            this.nav.setRoot(page.component, params);
        }
    };
    MyApp.prototype.isActive = function (page) {
        // Again the Tabs Navigation
        var childNav = this.nav.getActiveChildNavs()[0];
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
    };
    MyApp.prototype.closeSession = function () {
        var _this = this;
        var showLoadind = this.loadingController.create({
            content: "Cerrando sesión"
        });
        showLoadind.present();
        try {
            Promise.all([this.storage.get("authcToken"), this.storage.get("numberPhone")]).then(function (values) {
                var storageResponse = values;
                showLoadind.present();
                _this.closeSessionProvider.logOut(storageResponse).then(function (data) {
                    showLoadind.dismiss();
                    _this.storage.clear();
                    _this.nav.setRoot(__WEBPACK_IMPORTED_MODULE_5__pages_login_login__["a" /* LoginPage */]);
                });
            });
        }
        catch (error) {
            console.log("LOG ERROR closeSession " + error);
            this.presentAlert(999);
            this.storage.clear();
            showLoadind.dismiss();
        }
    };
    MyApp.prototype.presentAlert = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var alert, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = code;
                        switch (_a) {
                            case 401: return [3 /*break*/, 1];
                        }
                        return [3 /*break*/, 4];
                    case 1: return [4 /*yield*/, this.alertController.create({
                            message: 'Operación exitosa.',
                            buttons: ['OK']
                        })];
                    case 2:
                        alert = _b.sent();
                        return [4 /*yield*/, alert.present()];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 4: return [4 /*yield*/, this.alertController.create({
                            message: 'Lo sentimos estamos teniendo problemas de conexión.',
                            buttons: ['OK']
                        })];
                    case 5:
                        alert = _b.sent();
                        return [4 /*yield*/, alert.present()];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["_8" /* ViewChild */])(__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["h" /* Nav */]),
        __metadata("design:type", __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["h" /* Nav */])
    ], MyApp.prototype, "nav", void 0);
    MyApp = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/app/app.html"*/'<ion-menu [content]="content">\n  <ion-content class="bg-alma"> <!--class="bg-alma"-->\n\n      <ion-item class="bg-alma">\n          <ion-avatar item-start class="borde-naranjo">\n            <!--<img src="assets/imgs/logo.png">-->\n            <img src="https://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50" alt="user">\n          </ion-avatar>\n          <h2>{{fullName}}</h2>\n          <p>Tu numero es el {{phoneNumber}}</p>\n      </ion-item>\n\n    <ion-list>\n      <button class="bg-alma" menuClose ion-item *ngFor="let p of pages" (click)="openPage(p)">\n        <ion-icon item-start class="icon-menu" [name]="p.icon" [color]="isActive(p)"></ion-icon>\n        {{p.title}}\n      </button>\n    </ion-list>\n\n    <ion-list>\n        <ion-list-header class="bg-alma">\n          Cuenta\n        </ion-list-header>\n        <button class="bg-alma" ion-item menuClose *ngFor="let p of loggedOutPages" (click)="openPage(p)">\n          <ion-icon item-start class="icon-menu" [name]="p.icon" [color]="isActive(p)"></ion-icon>\n          {{p.title}}\n        </button>\n        <button class="bg-alma" ion-item menuClose (click)="closeSession()">\n          <ion-icon item-start name="exit" class="icon-menu"></ion-icon>      \n          Cerrar session\n        </button>\n      </ion-list>\n      <!--person-add-->\n  </ion-content>\n\n</ion-menu>\n\n<!-- Disable swipe-to-go-back because it\'s poor UX to combine STGB with side menus -->\n<ion-nav [root]="rootPage" #content swipeBackEnabled="false"></ion-nav>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/app/app.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["k" /* Platform */],
            __WEBPACK_IMPORTED_MODULE_2__ionic_native_status_bar__["a" /* StatusBar */],
            __WEBPACK_IMPORTED_MODULE_4__ionic_native_splash_screen__["a" /* SplashScreen */],
            __WEBPACK_IMPORTED_MODULE_3__ionic_storage__["b" /* Storage */],
            __WEBPACK_IMPORTED_MODULE_9__providers_subscriber_information_subscriber_information__["a" /* SubscriberInformationProvider */],
            __WEBPACK_IMPORTED_MODULE_10__providers_close_session_close_session__["a" /* CloseSessionProvider */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["f" /* LoadingController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["a" /* AlertController */]])
    ], MyApp);
    return MyApp;
}());

//# sourceMappingURL=app.component.js.map

/***/ }),

/***/ 307:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return HomePage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};


var HomePage = /** @class */ (function () {
    function HomePage(navCtrl) {
        this.navCtrl = navCtrl;
    }
    HomePage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-home',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/home/home.html"*/'<ion-header>\n  <ion-navbar>\n    <button ion-button menuToggle>\n      <ion-icon name="menu"></ion-icon>\n    </button>\n    <ion-title>Primero</ion-title>\n  </ion-navbar>\n</ion-header>\n\n<ion-content class="fondo" padding>\n\n    <button ion-button>Boton</button>\n\n</ion-content>\n\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/home/home.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */]])
    ], HomePage);
    return HomePage;
}());

//# sourceMappingURL=home.js.map

/***/ }),

/***/ 308:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return ListPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};


var ListPage = /** @class */ (function () {
    function ListPage(navCtrl, navParams) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        // If we navigated to this page, we will have an item available as a nav param
        this.selectedItem = navParams.get('item');
        // Let's populate this page with some filler content for funzies
        this.icons = ['flask', 'wifi', 'beer', 'football', 'basketball', 'paper-plane',
            'american-football', 'boat', 'bluetooth', 'build'];
        this.items = [];
        for (var i = 1; i < 11; i++) {
            this.items.push({
                title: 'Item ' + i,
                note: 'This is item #' + i,
                icon: this.icons[Math.floor(Math.random() * this.icons.length)]
            });
        }
    }
    ListPage_1 = ListPage;
    ListPage.prototype.itemTapped = function (event, item) {
        // That's right, we're pushing to ourselves!
        this.navCtrl.push(ListPage_1, {
            item: item
        });
    };
    ListPage = ListPage_1 = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-list',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/list/list.html"*/'<ion-header>\n  <ion-navbar>\n    <button ion-button menuToggle>\n      <ion-icon name="menu"></ion-icon>\n    </button>\n    <ion-title>List</ion-title>\n  </ion-navbar>\n</ion-header>\n\n<ion-content>\n  <ion-list>\n    <button ion-item *ngFor="let item of items" (click)="itemTapped($event, item)">\n      <ion-icon [name]="item.icon" item-start></ion-icon>\n      {{item.title}}\n      <div class="item-note" item-end>\n        {{item.note}}\n      </div>\n    </button>\n  </ion-list>\n  <div *ngIf="selectedItem" padding>\n    You navigated here from <b>{{selectedItem.title}}</b>\n  </div>\n</ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/list/list.html"*/
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */], __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */]])
    ], ListPage);
    return ListPage;
    var ListPage_1;
}());

//# sourceMappingURL=list.js.map

/***/ }),

/***/ 36:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return API_CONFIG; });
var API_CONFIG = {
    baseAPI: "http://192.168.119.84:16080/MobileEndPoint/api/",
    //baseAPI: "http://localhost:8080/MobileEndPoint/api/",
    authenticator: "authenticator",
    prefix: "apiv1",
    tokenDemo:"NzU2NjMzNDQ7OWU4MDA2ODUtMzIyZS00OWFiLWFhMDItMzU4NDY1MGY3NWVj",
    enviroment:"dev", //prod or dev 
    operator:"ESMERO"
}



/***/ }),

/***/ 46:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return LoginCheckPage; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__login_access_login_access__ = __webpack_require__(113);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__ionic_storage__ = __webpack_require__(28);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__providers_generate_code_generate_code__ = __webpack_require__(184);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};





var LoginCheckPage = /** @class */ (function () {
    function LoginCheckPage(navCtrl, navParams, storage, generateCodeProvider) {
        this.navCtrl = navCtrl;
        this.navParams = navParams;
        this.storage = storage;
        this.generateCodeProvider = generateCodeProvider;
        this.responseVerification = {};
        this.lista = [];
    }
    LoginCheckPage.prototype.ionViewDidLoad = function () {
        console.log('ionViewDidLoad LoginCheckPage');
    };
    LoginCheckPage.prototype.btnCheck = function () {
        var _this = this;
        console.log("NUMERO DE TELF " + this.nPhone);
        if (this.isValid(this.nPhone)) {
            console.log("******ENTRANDO AL REDIRECT DEL LoginAccessPage ******** ");
            this.generateCodeProvider.createVerificationCode(this.nPhone)
                .then(function (data) {
                _this.responseVerification = data;
                console.log("data generateCodeProvider: " + data["message"]);
                console.log(JSON.stringify(data));
                console.log("genericCode: " + data["genericCode"]);
                _this.verificationCode = data["genericCode"];
                _this.storage.set('genericCode', _this.verificationCode);
                _this.navCtrl.push(__WEBPACK_IMPORTED_MODULE_2__login_access_login_access__["a" /* LoginAccessPage */], {
                    numberPhone: _this.nPhone
                });
            });
        }
    };
    LoginCheckPage.prototype.isValid = function (phoneNumber) {
        var valid = true;
        if (phoneNumber == '' || phoneNumber == null) {
            return valid = false;
        }
        return valid;
    };
    LoginCheckPage = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_0__angular_core__["m" /* Component */])({
            selector: 'page-login-check',template:/*ion-inline-start:"/home/pancho-alma/git/MVNO/almatel/src/pages/login-check/login-check.html"*/'<ion-content class="bg-login">\n    <img src="/assets/imgs/logo-blanco.png" class="logo"/>\n  \n    <h1>Ingresa tu número para inciar sesión</h1>\n\n      <ion-item class="datosLogin">\n        <ion-label floating>N° Teléfonico</ion-label>\n        <ion-input [(ngModel)]="nPhone" type="number" required></ion-input>\n      </ion-item>\n\n    <button ion-button (click)="btnCheck()" class="cta-naranjo">Verificar</button>\n    \n  </ion-content>\n'/*ion-inline-end:"/home/pancho-alma/git/MVNO/almatel/src/pages/login-check/login-check.html"*/,
        }),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_1_ionic_angular__["i" /* NavController */],
            __WEBPACK_IMPORTED_MODULE_1_ionic_angular__["j" /* NavParams */], __WEBPACK_IMPORTED_MODULE_3__ionic_storage__["b" /* Storage */],
            __WEBPACK_IMPORTED_MODULE_4__providers_generate_code_generate_code__["a" /* GenerateCodeProvider */]])
    ], LoginCheckPage);
    return LoginCheckPage;
}());

//# sourceMappingURL=login-check.js.map

/***/ }),

/***/ 52:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PlansProvider; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_common_http__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__config_api_js__ = __webpack_require__(36);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__ = __webpack_require__(37);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};





/*
  Generated class for the PlansProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
var PlansProvider = /** @class */ (function () {
    function PlansProvider(httpClient, platform, http) {
        this.httpClient = httpClient;
        this.platform = platform;
        this.http = http;
        console.log('ConsumptionProvider Provider');
    }
    PlansProvider.prototype.getTariffPlanList = function (tokenParam, typePlan) {
        var _this = this;
        var developerMode = "" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].enviroment;
        if (this.isDeveloper(developerMode)) {
            console.log("MODE " + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].enviroment);
            return new Promise(function (resolve) {
                _this.httpClient.post("http://192.168.119.84:19080/ServicesPlanListWS/api/planService/getTariffPlanList/", typePlan, {})
                    .subscribe(function (data) {
                    resolve(data.tariffPlanList);
                }, function (error) {
                    console.log(error);
                });
            });
        }
        else {
            console.log("MODE " + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].enviroment);
            return this.platform.ready().then(function () {
                return _this.http.get(__WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + "portal/getConsumptionsByTelephoneNumber/" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].operator, {}, { 'token': tokenParam });
            });
        }
    };
    PlansProvider.prototype.isDeveloper = function (mode) {
        var isDev = false;
        if (mode == 'dev') {
            return isDev = true;
        }
        return isDev;
    };
    PlansProvider = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["A" /* Injectable */])(),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_0__angular_common_http__["a" /* HttpClient */],
            __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["k" /* Platform */],
            __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__["a" /* HTTP */]])
    ], PlansProvider);
    return PlansProvider;
}());

//# sourceMappingURL=plans.js.map

/***/ }),

/***/ 87:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return SubscriberInformationProvider; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__angular_common_http__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_ionic_angular__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__config_api_js__ = __webpack_require__(36);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__ = __webpack_require__(37);
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};





var SubscriberInformationProvider = /** @class */ (function () {
    function SubscriberInformationProvider(httpClient, loadingController, httpN, platform) {
        this.httpClient = httpClient;
        this.loadingController = loadingController;
        this.httpN = httpN;
        this.platform = platform;
        console.log('Hello SubscriberInformationProvider Provider');
    }
    SubscriberInformationProvider.prototype.getSubscriberInformation = function (token, nPhone) {
        var _this = this;
        var showLoadind = this.loadingController.create({
            content: "Cargando datos"
        });
        showLoadind.present();
        return new Promise(function (resolve) {
            _this.httpClient.get(__WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].baseAPI + "portal/getSubscriberInformation/" + nPhone + "/" + __WEBPACK_IMPORTED_MODULE_3__config_api_js__["a" /* API_CONFIG */].operator, { headers: { 'token': "" + token } }).subscribe(function (data) {
                resolve(data);
                showLoadind.dismiss();
            }, function (err) {
                console.log("* Error getSubscriberInformation() *");
                console.log(err);
                showLoadind.dismiss();
            });
        });
    };
    SubscriberInformationProvider.prototype.getData2 = function () {
        var _this = this;
        this.platform.ready().then(function () {
            //let headers = new Headers();
            // headers.append('Content-Type', 'application/json');
            // headers.append('Authorization', 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMC9hcGkvbG9naW4iLCJpYXQiOjE1NTU4Njc3NjIsImV4cCI6MTU1NTk1NDE2MiwibmJmIjoxNTU1ODY3NzYyLCJqdGkiOiIxS052ZVVoenV6QUJIN0NVIn0.eKL5-80plAKrB38ZYrzHIGxFZbQgNN0LMVluLRYIss0');            
            _this.httpN.get('http://192.168.119.84:16080/MobileEndPoint/api/portal/getSubscriberInformation/75663344/ESMERO', {}, { "Content-Type": "application/json", "token": "NzU2NjMzNDQ7NWZmYmJjZTItMjM2Ni00YTBjLWE0ZWUtMzJmN2Y3ZTc4NDRh" })
                .then(function (data) {
                console.log("data.status: " + data.status);
                console.log("data.data: " + data.data); // data received by server
                console.log("data.headers: " + data.headers);
            })
                .catch(function (error) {
                console.log("error.status: " + error.status);
                console.log("error.error: " + error.error); // error message as string
                console.log("error.headers: " + error.headers);
            });
        });
    };
    SubscriberInformationProvider = __decorate([
        Object(__WEBPACK_IMPORTED_MODULE_1__angular_core__["A" /* Injectable */])(),
        __metadata("design:paramtypes", [__WEBPACK_IMPORTED_MODULE_0__angular_common_http__["a" /* HttpClient */],
            __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["f" /* LoadingController */],
            __WEBPACK_IMPORTED_MODULE_4__ionic_native_http__["a" /* HTTP */],
            __WEBPACK_IMPORTED_MODULE_2_ionic_angular__["k" /* Platform */]])
    ], SubscriberInformationProvider);
    return SubscriberInformationProvider;
}());

//# sourceMappingURL=subscriber-information.js.map

/***/ })

},[230]);
//# sourceMappingURL=main.js.map