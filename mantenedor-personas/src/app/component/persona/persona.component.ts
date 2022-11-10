import { Component, OnInit } from '@angular/core';
import { PersonaService } from 'src/app/services/persona.service';
import { Persona } from 'src/app/models/persona';
import { Region } from 'src/app/models/region';
import { Comuna } from 'src/app/models/comuna';
import {FormBuilder, FormGroup, Validators} from '@angular/forms'; 
import { Router,ActivatedRoute } from '@angular/router';
import { ComunasService } from 'src/app/services/comunas.service';

@Component({
  selector: 'app-persona',
  templateUrl: './persona.component.html',
  styleUrls: ['./persona.component.css'],
  providers:[PersonaService,ComunasService]
})
export class PersonaComponent implements OnInit {

  formPersona:FormGroup;
  persona:Persona = new Persona();
 
  regiones:Region[] = [
    {id: 0, descripcion: 'Metropolitana'},
    {id: 1, descripcion: 'Metropolitana 1'},
    {id: 2, descripcion: 'Metropolitana 2'},
  ];
  comunas:Comuna[] = [
    {id: 0, descripcion: 'San Miguel',region:0},
    {id: 1, descripcion: 'La Florida',region:2},
    {id: 2, descripcion: 'Puente alto',region:1},
  ];
  selectedRegion:number=0;
  selectedComuna:number=0;
  constructor(private _personaService:PersonaService,public fb: FormBuilder,	private _route: ActivatedRoute,
		private _router: Router,private _personaServices:PersonaService,private _comunaService:ComunasService) {
    this.formPersona = this.fb.group({ 
      nombre: ['', [Validators.required]], 
      apellido: ['', [Validators.required]], 
      correo: ['' , [Validators.required,Validators.email]], 
      telefono: ['', [Validators.required,Validators.min(123456789)]],
      fecha_nacimiento: ['', [Validators.required]]
    
    }); 
   }

  ngOnInit(): void {
    console.log('hola')
  }

  enviar(){

    this.persona = this.formPersona.value;
    this.persona.comuna = this.comunas[this.selectedComuna];
    this.persona.region =  this.regiones[this.selectedRegion] 
    console.log(this.formPersona);
    this._personaService.guardar(this.persona);
    this._router.navigate(['/list-persona']);
    
  }

  change(id:number){
   this.selectedComuna = this._comunaService.getComuna(id);
   console.log(this.selectedComuna);
  }

}
