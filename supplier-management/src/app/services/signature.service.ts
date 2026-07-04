import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

const SIG_FIELDS = new Set([
  '_signatureHash', '_signedAt', '_signedBy', '_signedByName',
  '_signedByEmail', '_signatureAlgorithm',
]);

const META_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'created_at', 'updated_at',
]);

/**
 * Firma Electrónica Simple (FES) via SHA-256 — Ley 19.799.
 *
 * Signs a record by:
 *   payload = "<entityKey>|<ISO timestamp>|<userId>|<canonical JSON>"
 *   hash    = SHA-256(payload)  →  stored as _signatureHash
 *
 * The canonical JSON excludes signature meta-fields, id, and audit timestamps
 * so the hash is stable across API round-trips.
 */
@Injectable({ providedIn: 'root' })
export class SignatureService {
  private auth = inject(AuthService);

  async signRecord(
    entityKey: string,
    data: Record<string, unknown>
  ): Promise<Record<string, string>> {
    const user      = this.auth.user();
    const timestamp = new Date().toISOString();
    const canonical = this._canonicalize(data);
    const payload   = `${entityKey}|${timestamp}|${user?.id ?? ''}|${JSON.stringify(canonical)}`;
    const hash      = await this._sha256(payload);

    return {
      _signatureHash:      hash,
      _signedAt:           timestamp,
      _signedBy:           String(user?.id ?? ''),
      _signedByName:       user?.name ?? '',
      _signedByEmail:      user?.email ?? '',
      _signatureAlgorithm: 'SHA-256-FES-v1',
    };
  }

  async verifyRecord(
    entityKey: string,
    data: Record<string, unknown>
  ): Promise<boolean> {
    const d = data as Record<string, string>;
    const { _signatureHash, _signedAt, _signedBy } = d;
    if (!_signatureHash || !_signedAt) return false;

    const canonical = this._canonicalize(data);
    const payload   = `${entityKey}|${_signedAt}|${_signedBy}|${JSON.stringify(canonical)}`;
    const expected  = await this._sha256(payload);
    return expected === _signatureHash;
  }

  formatSignedAt(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleString('es-CL', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return isoDate; }
  }

  private async _sha256(message: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private _canonicalize(data: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([k]) => !SIG_FIELDS.has(k) && !META_FIELDS.has(k))
        .sort(([a], [b]) => a.localeCompare(b))
    );
  }
}
