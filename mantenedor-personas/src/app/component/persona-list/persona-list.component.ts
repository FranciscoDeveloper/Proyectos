import { Component, OnInit } from '@angular/core';
import { Persona } from 'src/app/models/persona';
import { PersonaService } from 'src/app/services/persona.service';
import { Observable } from 'rxjs';
@Component({
  selector: 'app-persona-list',
  templateUrl: './persona-list.component.html',
  styleUrls: ['./persona-list.component.css'],
  providers:[PersonaService]
})
export class PersonaListComponent implements OnInit {

  public personas:Observable<Persona[]>;

  constructor(private _personaServices:PersonaService) { 
     this.personas = this._personaServices.listarPersonas();
  }

  ngOnInit(): void {
  }

  borrar(persona:Persona):void{
    this._personaServices.eliminar(persona);
  }

}
