import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PersonaComponent } from './component/persona/persona.component';
import { PersonaListComponent } from './component/persona-list/persona-list.component';
import { PersonaEditComponent } from './component/persona-edit/persona-edit.component';
const routes: Routes = [
  {path: 'persona',component:PersonaComponent},
  {path: 'persona-list',component:PersonaListComponent},
  {path: 'persona-edit/:id', component: PersonaEditComponent}


    
];

@NgModule({
  
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
