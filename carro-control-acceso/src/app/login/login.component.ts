import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';
import { AngularFireAuth  } from '@angular/fire/auth';
import { AlertService, AuthenticationService } from '../_services';
import * as firebase from 'firebase/app';
import { User } from '../_models';
@Component({
    templateUrl: 'login.component.html',
    styleUrls: ['login.component.css']

})
export class LoginComponent implements OnInit {
    loginForm: FormGroup;
    loading = false;
    submitted = false;
    returnUrl: string;
     firebase = require('firebase');
     firebaseui = require('firebaseui');
    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private authenticationService: AuthenticationService,
        private alertService: AlertService,
        public afAuth: AngularFireAuth) {
           
        }

    ngOnInit() {
       
       

        this.loginForm = this.formBuilder.group({
            username: ['', Validators.required],
            password: ['', Validators.required]
        });

        // reset login status
        this.authenticationService.logout();

        // get return url from route parameters or default to '/'
        this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    }

    // convenience getter for easy access to form fields
    get f() { return this.loginForm.controls; }

    onSubmit() {
        this.submitted = true;

        // stop here if form is invalid
        if (this.loginForm.invalid) {
            return;
        }

        this.loading = true;
        this.authenticationService.login(this.f.username.value, this.f.password.value)
            .pipe(first())
            .subscribe(
                data => {
                    this.router.navigate([this.returnUrl]);
                },
                error => {
                    this.alertService.error(error);
                    this.loading = false;
                });
    }

    doFacebookLogin(){
        return new Promise<any>((resolve, reject) => {
          let provider = new firebase.auth.FacebookAuthProvider();
          this.afAuth.auth
          .signInWithPopup(provider)
          .then(res => {
            resolve(res);
            this.userAccessControl(res);
          }, err => {
            console.log(err);
            reject(err);
          })
        })
     }


     doGoogleLogin(){
        return new Promise<any>((resolve, reject) => {
          let provider = new firebase.auth.GoogleAuthProvider();
          provider.addScope('profile');
          provider.addScope('email');
          this.afAuth.auth
          .signInWithPopup(provider)
          .then(res => {
            resolve(res);
            this.userAccessControl(res);
          })
        })
      
      }
  

      userAccessControl(res){
        if (res.user && res.credential.accessToken) {
          // store user details and jwt token in local storage to keep user logged in between page refreshes
          var currentUser: User= new User();
          currentUser.firstName=res.user.displayName;
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
        this.router.navigate([this.returnUrl]);
      }

     




      
}
