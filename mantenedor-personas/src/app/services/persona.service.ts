import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { HttpClient,HttpResponse,HttpHeaders } from '@angular/common/http';
import { Persona } from '../models/persona';

@Injectable({
  providedIn: 'root'
})
export class PersonaService {
  urlListPersonas = 'assets/list.json';//debe ser manejado el intercambio de recursos de origen cruzado (CORS) desde el backend en un escenario real.
  urlGuardar = 'localhost:8080/crear';
  urlEliminar = 'localhost:8080/borrar';
  urlEditar =  'localhost:8080/editar';
  public personas:Persona[]=[];
  constructor(private http: HttpClient) {

  }

  listarPersonas():Observable<Persona[]> {
    return this.http.get<Persona[]>(this.urlListPersonas);
  }

   guardar(persona:Persona){
    this.post(persona,this.urlGuardar);
   }
   editar(persona:Persona){
    this.post(persona,this.urlEditar);
   }
   eliminar(persona:Persona){
    this.post(persona,this.urlEliminar);
   }

   private post(persona:Persona,url:string){
    
    let json = JSON.stringify(persona);
		let headers = new HttpHeaders({'Content-Type':'application/json'});
		return this.http.post(url, json, {headers: headers}).subscribe(
      (data: {}) => {
       // this.persona = data;
      },
      error => {
        console.log(<any>error);
      }
    );
   }
}
