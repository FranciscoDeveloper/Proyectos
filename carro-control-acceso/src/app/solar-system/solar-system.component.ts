import { Component, OnInit } from '@angular/core';
import{ Http }from "@angular/http";
import { map } from 'rxjs/operators';
@Component({
  selector: 'app-solar-system',
  templateUrl: './solar-system.component.html',
  styleUrls: ['./solar-system.component.css']
})
export class SolarSystemComponent implements OnInit {
  private externalUrl:any;
  constructor(http:  Http) {
     http.get("https://www.google.cl").pipe(map(rest => rest.json())).subscribe(
      {
        next(response) { console.log(response); },
        error(err) { console.error('Error: ' + err); },
        complete() { console.log('Completed'); }
       }
    );
     console.log(this.externalUrl);
  }

  ngOnInit() {
  }

}
