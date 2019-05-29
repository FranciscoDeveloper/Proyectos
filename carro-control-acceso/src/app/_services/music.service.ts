import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
@Injectable({
  providedIn: 'root'
})
export class MusicService {
   endpoint = 'https://deezerdevs-deezer.p.rapidapi.com/search?q=';
   httpOptions = {
   
  };
  constructor(private http: HttpClient) {


   }

   getMusics(){
    return this.http.get(this.endpoint + 'eminem',{
      headers:{     'Content-Type':  'application/json',
      'X-RapidAPI-Host': 'deezerdevs-deezer.p.rapidapi.com',
      'X-RapidAPI-Key': '08a25024c0msh1194e2ee37bbbe1p1996c0jsn3a3768b98f5a'}
    });
  }


  
}
//https://deezerdevs-deezer.p.rapidapi.com/search?q=eminem
//.header("X-RapidAPI-Host", "deezerdevs-deezer.p.rapidapi.com")
//.header("X-RapidAPI-Key", "08a25024c0msh1194e2ee37bbbe1p1996c0jsn3a3768b98f5a")