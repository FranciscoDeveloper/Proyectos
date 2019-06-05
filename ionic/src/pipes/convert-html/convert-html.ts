import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer,SafeHtml } from '@angular/platform-browser';

/**
 * Generated class for the ConverthtmlPipe pipe.
 *
 * See https://angular.io/api/core/Pipe for more info on Angular Pipes.
 */
@Pipe({
  name: 'converthtml',
  pure: false,
})
export class ConverthtmlPipe implements PipeTransform {
  /**
   * Takes a value and makes it lowercase.
   */
  constructor(private sanitizer: DomSanitizer) {

  }


  transform(content) {
    return this.sanitizer.bypassSecurityTrustHtml(content);
    }
  }
