import { Injectable } from '@angular/core';
import { Comuna } from '../models/comuna';

@Injectable({
  providedIn: 'root'
})
export class ComunasService {

  constructor() { }


  getComuna(id:number){
    if(id==0){
      return  0;
    }
    if(id==1){
      return 2;
    }
    if(id==2){
      return 1;
    }
    return 0;
  }
}
