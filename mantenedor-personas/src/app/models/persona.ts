import { Comuna } from "./comuna";
import { Region } from "./region";

export class Persona {

    public id:number=0;
    public nombre:string="";
    public apellido:string="";
    public correo:string="";
    public fecha_nacimiento:Date=new Date();
    public telefono:number=0;
    public region:Region=new Region();
    public comuna:Comuna=new Comuna();

    constructor(){

    }
}
