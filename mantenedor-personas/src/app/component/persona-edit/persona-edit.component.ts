import { Component, OnInit,Input } from '@angular/core';
import { PersonaService } from 'src/app/services/persona.service';
import { Persona } from 'src/app/models/persona';
import { Region } from 'src/app/models/region';
import { Comuna } from 'src/app/models/comuna';
import {FormBuilder, FormGroup, Validators} from '@angular/forms'; 
import { Router,ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-persona-edit',
  templateUrl: './persona-edit.component.html',
  styleUrls: ['./persona-edit.component.css'],
  providers:[PersonaService]
})
export class PersonaEditComponent implements OnInit {

  formPersonaEdit:FormGroup;
  
  @Input()
  persona:Persona = new Persona();
  
  

  regiones:Region[] = [
    {id: 0, descripcion: 'Steak'},
    {id: 1, descripcion: 'Pizza'},
    {id: 2, descripcion: 'Tacos'},
  ];
  comunas:Comuna[] = [
    {id: 0, descripcion: 'San Miguel',region:0},
    {id: 1, descripcion: 'La Florida',region:2},
    {id: 2, descripcion: 'Puente alto',region:1},
  ];
  selectedRegion:number=0;
  selectedComuna:number=0;
  constructor(private _router: Router,private _personaEditService:PersonaService,private _activeRoute:ActivatedRoute,public fb: FormBuilder,) { 
    this.formPersonaEdit = this.fb.group({ 
      nombre: ['', [Validators.required]], 
      apellido: ['', [Validators.required]], 
      correo: ['' , [Validators.required,Validators.email]], 
      telefono: ['', [Validators.required,Validators.min(123456789)]],
      fecha_nacimiento: ['', [Validators.required]]
    
    });
    console.log(_activeRoute);
  }

  ngOnInit(): void {
  }
  editar(){
   
    this.persona = this.formPersonaEdit.value;
    this.persona.comuna = this.comunas[this.selectedComuna];
    this.persona.region =  this.regiones[this.selectedRegion] 
    console.log(this.formPersonaEdit);
    this._personaEditService.editar(this.persona)
    this._router.navigate(['/list-persona']);
  }

}
