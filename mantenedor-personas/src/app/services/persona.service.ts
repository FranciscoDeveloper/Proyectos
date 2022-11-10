import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { HttpClient,HttpResponse,HttpHeaders } from '@angular/common/http';
import { Persona } from '../models/persona';

@Injectable({
  providedIn: 'root'
})
export class PersonaService {
  urlListPersonas = 'assets/list.json';
  urlGuardar = '';
  urlEliminar = '';
  urlEditar = '';
  public personas:Persona[]=[];
  constructor(private http: HttpClient) {

  }

  listarPersonas():Observable<Persona[]> {
    return this.http.get<Persona[]>(this.urlListPersonas);
  }

   guardar(persona:Persona){
    this.post(persona);
   }
   editar(persona:Persona){
    this.post(persona);
   }
   eliminar(persona:Persona){
    this.post(persona);
   }

   private post(persona:Persona){
    this.http.post(this.urlListPersonas,persona);
    let json = JSON.stringify(persona);
		let headers = new HttpHeaders({'Content-Type':'application/json'});
		return this.http.post(this.urlListPersonas, json, {headers: headers}).subscribe(
      (data: {}) => {
       // this.persona = data;
      },
      error => {
        console.log(<any>error);
      }
    );
   }
}
