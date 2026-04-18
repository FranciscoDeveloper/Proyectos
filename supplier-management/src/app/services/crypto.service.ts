import { Injectable, signal, computed } from '@angular/core';

const ZK_PREFIX = 'zk1:';
const THUMB_SK  = 'zk_thumb';

/**
 * Authoritative list of fields encrypted per entity.
 * Server only ever stores ciphertext for these fields — Zero-Knowledge model.
 */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  suppliers: [
    'email', 'phone', 'address', 'taxId', 'contactPerson', 'notes'
  ],
  appointments: [
    'patientEmail', 'notes'
  ],
  patients: [
    'phone', 'email', 'diagnosis', 'allergies'
  ],
  'clinical-records': [
    'rut', 'phone', 'email', 'address', 'emergencyContact',
    'allergies', 'contraindications', 'alertNotes',
    'bp', 'heartRate', 'temperature', 'o2Saturation', 'weight', 'height', 'bmi', 'respiratoryRate',
    'personalHistory', 'familyHistory', 'habits',
    'surgicalHistory', 'plannedInterventions',
    'currentMedications', 'diagnosisCode', 'diagnosisLabel', 'differentialDx',
    'soapSubjective', 'soapObjective', 'soapAssessment', 'soapPlan'
  ],
  'psych-sessions': [
    'patientEmail', 'notes'
  ],
  'psych-records': [
    'rut', 'phone', 'email', 'address', 'emergencyContact',
    'allergies', 'contraindications', 'alertNotes',
    'bp', 'heartRate', 'temperature', 'o2Saturation', 'weight', 'height', 'bmi', 'respiratoryRate',
    'personalHistory', 'familyHistory', 'habits',
    'surgicalHistory', 'plannedInterventions',
    'currentMedications', 'diagnosisCode', 'diagnosisLabel', 'differentialDx',
    'soapSubjective', 'soapObjective', 'soapAssessment', 'soapPlan'
  ],
  'dental-sessions': [
    'patientEmail', 'notes'
  ],
  'dental-records': [
    'rut', 'phone', 'email',
    'allergies', 'contraindications', 'alertNotes',
    'bp', 'heartRate', 'temperature', 'o2Saturation', 'weight', 'height', 'bmi', 'respiratoryRate',
    'personalHistory', 'familyHistory', 'habits',
    'surgicalHistory', 'plannedInterventions',
    'currentMedications', 'diagnosisCode', 'diagnosisLabel', 'differentialDx',
    'soapSubjective', 'soapObjective', 'soapAssessment', 'soapPlan'
  ],
  payments:  ['notes'],
  expenses:  ['notes'],
};

/** Fields that are chat message content */
export const CHAT_ENCRYPTED_FIELDS = ['content'];

/** Supplier-specific encrypted fields (SupplierService uses its own endpoint) */
export const SUPPLIER_ENCRYPTED_FIELDS = ENCRYPTED_FIELDS['suppliers'];

interface ZkCertificate {
  type:    'dairi-zk-certificate';
  version: number;
  email:   string;
  created: string;
  key:     string; // base64-encoded raw 256-bit AES key
}

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private readonly _key      = signal<CryptoKey | null>(null);
  private readonly _hasThumb = signal(!!localStorage.getItem(THUMB_SK));

  /** True when the AES-256-GCM key is loaded in memory */
  readonly isReady     = computed(() => !!this._key());
  /**
   * True when a certificate thumbprint is registered on this device but the
   * in-memory key was lost (page reload). Shows the upload-certificate banner.
   */
  readonly needsUnlock = computed(() => this._hasThumb() && !this._key());
  /**
   * True when the user has never generated a ZK certificate on this device.
   * Shows the initial setup banner.
   */
  readonly needsSetup  = computed(() => !this._hasThumb() && !this._key());

  // ─── Public API ──────────────────────────────────────────────────────────────

  getEncryptedFields(entityKey: string): string[] {
    return ENCRYPTED_FIELDS[entityKey] ?? [];
  }

  isEncryptedField(entityKey: string, fieldName: string): boolean {
    return (ENCRYPTED_FIELDS[entityKey] ?? []).includes(fieldName);
  }

  isEncryptedValue(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith(ZK_PREFIX);
  }

  // ─── Certificate lifecycle ────────────────────────────────────────────────────

  /**
   * Generates a random AES-256-GCM key, wraps it in a JSON certificate file,
   * triggers a browser download, and activates the key in memory.
   * The certificate file is the only copy of the key — the user must keep it safe.
   */
  async generateAndDownloadCertificate(email: string): Promise<void> {
    // Generate an extractable key so we can write it to the certificate
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const keyB64 = btoa(String.fromCharCode(...rawKey));
    const thumb  = await this._thumbprint(rawKey);

    const cert: ZkCertificate = {
      type:    'dairi-zk-certificate',
      version: 1,
      email:   email.toLowerCase().trim(),
      created: new Date().toISOString(),
      key:     keyB64,
    };

    // Download the certificate
    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `dairi-zk-${email.split('@')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Re-import as non-extractable for in-memory use
    const importedKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
    this._key.set(importedKey);
    localStorage.setItem(THUMB_SK, thumb);
    this._hasThumb.set(true);
  }

  /**
   * Reads a `.json` ZK certificate file, imports the AES key, and verifies it
   * matches the thumbprint registered on this device.
   * Returns true on success, false if the file is invalid or mismatched.
   */
  async unlockWithCertificate(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const cert = JSON.parse(text) as ZkCertificate;
      if (cert.type !== 'dairi-zk-certificate' || !cert.key) return false;

      const rawKey = Uint8Array.from(atob(cert.key), c => c.charCodeAt(0));
      const thumb  = await this._thumbprint(rawKey);
      const stored = localStorage.getItem(THUMB_SK);

      if (stored && thumb !== stored) return false;

      const importedKey = await crypto.subtle.importKey(
        'raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
      );
      this._key.set(importedKey);

      if (!stored) {
        localStorage.setItem(THUMB_SK, thumb);
        this._hasThumb.set(true);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Called on logout: wipes the in-memory key but keeps the thumbprint so the
   * upload banner appears on next login instead of the setup banner.
   */
  clearKey(): void {
    this._key.set(null);
  }

  /** Clears both the in-memory key and the stored thumbprint (certificate reset). */
  clearHint(): void {
    this._key.set(null);
    this._hasThumb.set(false);
    localStorage.removeItem(THUMB_SK);
  }

  // ─── Encrypt / Decrypt primitives ────────────────────────────────────────────

  /** Encrypts a UTF-8 string. Returns a `zk1:<base64>` token. */
  async encrypt(plaintext: string): Promise<string> {
    const key = this._key();
    if (!key) return plaintext;

    const iv        = crypto.getRandomValues(new Uint8Array(12));
    const enc       = new TextEncoder();
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    const combined  = new Uint8Array(12 + cipherBuf.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(cipherBuf), 12);
    return ZK_PREFIX + btoa(String.fromCharCode(...combined));
  }

  /** Decrypts a `zk1:<base64>` token. Returns the plaintext or a locked placeholder. */
  async decrypt(cipherText: string): Promise<string> {
    if (!this.isEncryptedValue(cipherText)) return cipherText;
    const key = this._key();
    if (!key) return '[🔒 cifrado]';

    try {
      const combined = Uint8Array.from(atob(cipherText.slice(ZK_PREFIX.length)), c => c.charCodeAt(0));
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: combined.slice(0, 12) },
        key,
        combined.slice(12)
      );
      return new TextDecoder().decode(plainBuf);
    } catch {
      return '[🔒 cifrado]';
    }
  }

  // ─── Record-level helpers ─────────────────────────────────────────────────────

  async encryptFields<T extends Record<string, any>>(record: T, fields: string[]): Promise<T> {
    if (!this._key() || !fields.length) return record;
    const result = { ...record } as Record<string, any>;
    await Promise.all(fields.map(async field => {
      const val = result[field];
      if (val == null || val === '') return;
      if (this.isEncryptedValue(val)) return;
      const plaintext = typeof val === 'string' ? val : JSON.stringify(val);
      result[field] = await this.encrypt(plaintext);
    }));
    return result as T;
  }

  async decryptFields<T extends Record<string, any>>(record: T, fields: string[]): Promise<T> {
    if (!fields.length) return record;
    const result = { ...record } as Record<string, any>;
    await Promise.all(fields.map(async field => {
      const val = result[field];
      if (!this.isEncryptedValue(val)) return;
      const plaintext = await this.decrypt(val as string);
      try { result[field] = JSON.parse(plaintext); } catch { result[field] = plaintext; }
    }));
    return result as T;
  }

  async encryptRecord<T extends Record<string, any>>(record: T, entityKey: string): Promise<T> {
    const fields = this.getEncryptedFields(entityKey);
    return this.encryptFields(record, fields);
  }

  async decryptRecord<T extends Record<string, any>>(record: T, entityKey: string): Promise<T> {
    const fields = this.getEncryptedFields(entityKey);
    const result = await this.decryptFields(record, fields);
    const encs   = (result as any)['encounters'];
    if (Array.isArray(encs)) {
      (result as any)['encounters'] = await Promise.all(
        encs.map((e: Record<string, any>) => this.decryptFields(e, fields))
      );
    }
    return result;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async _thumbprint(rawKey: Uint8Array): Promise<string> {
    const hashBuf = await crypto.subtle.digest('SHA-256', rawKey);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuf)));
  }
}
