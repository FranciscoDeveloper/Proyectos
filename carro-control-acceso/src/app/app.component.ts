
import { Component,Input ,Output,EventEmitter,Inject} from '@angular/core';
import {MusicService} from './_services/music.service';
import  * as myGlobals from './_config/config';
@Component({
    selector: 'app',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.css']
})

export class AppComponent { 
   // @Output() messageEvent = new EventEmitter<boolean>();
    private cards:any;
    private musics:any;
    private total:number;
    private currency_code:string;
    constructor( msService:MusicService){
        this.currency_code=myGlobals.currency_code;
        msService.getMusics().subscribe((data: {}) => {
            console.log(data);
            this.musics=data;
          });;
    
        console.log( JSON.parse(localStorage.getItem("cards")));
         this.total= parseInt( localStorage.getItem("total"), 10);
        if( Number.isNaN( this.total)){
            this.total=0;
        }
       // if(localStorage.getItem["cards"]!=undefined){
            this.cards=JSON.parse(localStorage.getItem("cards"));
        //}else{
        //    this.cards=[{}];
       // }
     
      //  localStorage.setItem('cards',JSON.parse(JSON.stringify( this.cards)));
       //this.cards=JSON.parse( localStorage.getItem('cards'));
    //   console.log( JSON.parse(localStorage.getItem('cards'));
    }
  /*  getData(event:any){

        console.log(event);
    }*/

    trash(i){
        console.log(this.cards[i].price+' '+this.total);
        this.total-=this.cards[i].price;
        this.cards.splice(i,1);
        localStorage.setItem('cards',JSON.stringify(this.cards));
        localStorage.setItem('total', JSON.stringify(this.total));
    }

    go(){      
        this.cards=JSON.parse(localStorage.getItem("cards"));
        this.total=JSON.parse(localStorage.getItem("total"));
    }
    
}