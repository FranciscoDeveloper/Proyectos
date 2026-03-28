import { Injectable, inject } from '@angular/core';
import { EntitySchema } from '../models/entity-schema.model';
import { AuthService } from './auth.service';

/**
 * Provides schemas to components.
 *
 * In this Electron app, schemas come exclusively from the AuthService,
 * which received them from the Electron main process on login.
 * This service is a thin lookup facade — it knows nothing about actual data.
 */
@Injectable({ providedIn: 'root' })
export class SchemaService {
  private auth = inject(AuthService);

  getSchema(key: string): EntitySchema | null {
    return this.auth.schemas().find(s => s.entity.key === key) ?? null;
  }

  getAllSchemas(): EntitySchema[] {
    return this.auth.schemas();
  }
}
