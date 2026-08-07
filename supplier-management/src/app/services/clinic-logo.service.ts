import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface ClinicLogoResponse {
  key: string | null;
  url: string | null;
}

/**
 * Logo de la clínica: resuelve la key guardada en `user_config.clinic_logo_key`
 * (migración 017) a algo que se pueda pintar en la papelería imprimible.
 *
 * ── Por qué se devuelve un data URI y no la URL firmada ──────────────────────
 * `dairi-medical-documents` tiene bloqueo público total, así que la única forma
 * de leer el objeto es una URL pre-firmada que expira a los 300s (mismo patrón
 * que documentsHandler.mjs para patient-docs/). Los documentos donde va este
 * logo NO son páginas vivas:
 *
 *   · La receta / plan terapéutico se genera como un HTML suelto que se abre en
 *     una pestaña nueva (blob:) o, en nativo, se escribe como archivo real y se
 *     manda al share sheet — el usuario lo guarda en Files/Drive y lo imprime
 *     cuando quiere.
 *   · El presupuesto se serializa con NativeIoService.sharePrintableNode, que
 *     produce igualmente un archivo HTML independiente.
 *
 * Un <img src="https://…X-Amz-Expires=300"> dentro de esos archivos se ve roto
 * en cuanto pasan cinco minutos, que es exactamente cuando el usuario los abre.
 * Incrustar los bytes como data: URI hace el documento autocontenido y además
 * evita que el archivo compartido lleve dentro una URL firmada con credenciales.
 *
 * El resultado se cachea en memoria: la receta y el presupuesto lo piden por
 * separado y el logo no cambia dentro de una sesión.
 */
@Injectable({ providedIn: 'root' })
export class ClinicLogoService {
  private http = inject(HttpClient);

  /** Data URI del logo, o null si la cuenta no tiene. `undefined` = sin resolver. */
  private readonly _dataUri = signal<string | null | undefined>(undefined);
  readonly dataUri = this._dataUri.asReadonly();

  private inFlight: Promise<string | null> | null = null;

  /**
   * Devuelve el logo como data URI, o null si no hay (o si no se pudo obtener).
   * Nunca lanza: todos los llamadores deben poder caer al texto "Dairi Clínica".
   */
  async get(): Promise<string | null> {
    const cached = this._dataUri();
    if (cached !== undefined) return cached;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetch()
      .catch(() => null)
      .then(v => {
        this._dataUri.set(v);
        this.inFlight = null;
        return v;
      });

    return this.inFlight;
  }

  private async fetch(): Promise<string | null> {
    // Las cuentas Starter reciben 403 en cualquier ruta Postgres del BFF; el
    // catch de get() lo convierte en "sin logo", que es el comportamiento
    // correcto (su plan no emite recetas).
    const res = await firstValueFrom(
      this.http.get<ClinicLogoResponse>('/api/professionals/clinic-logo')
    );
    if (!res?.url) return null;

    // fetch() y no HttpClient a propósito: la URL firmada es absoluta y no debe
    // pasar por el apiInterceptor, que le adosaría el header Authorization y
    // rompería la firma de S3 (misma razón que uploadPhoto en el onboarding).
    const blob = await (await fetch(res.url)).blob();
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  /** Invalida la caché tras subir un logo nuevo en el onboarding. */
  reset(): void {
    this._dataUri.set(undefined);
    this.inFlight = null;
  }
}
