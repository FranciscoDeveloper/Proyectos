import { Injectable, signal, computed } from '@angular/core';

const ZK_PREFIX = 'zk1:';
const HINT_SK   = 'zk_hint';

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

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private readonly _key     = signal<CryptoKey | null>(null);
  private readonly _hasHint = signal(!!sessionStorage.getItem(HINT_SK));

  /** True when the AES-256-GCM key is loaded in memory */
  readonly isReady     = computed(() => !!this._key());
  /** True when there is a stored hint (= encrypted data exists) but the key is not loaded */
  readonly needsUnlock = computed(() => this._hasHint() && !this._key());

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

  // ─── Key lifecycle ────────────────────────────────────────────────────────────

  /**
   * Derives an AES-256-GCM key from the user's password via PBKDF2-SHA-256
   * (310 000 iterations, salt = SHA-256 of email). The raw key material never
   * leaves the Web Crypto subsystem — it is marked non-extractable.
   *
   * A password-verification hint (HMAC-SHA-256) is stored in sessionStorage so
   * the key can be re-derived after a page reload without storing the key itself.
   */
  async deriveKey(password: string, email: string): Promise<void> {
    const key  = await this._pbkdf2(password, email);
    const hint = await this._hmacHint(password, email);
    this._key.set(key);
    sessionStorage.setItem(HINT_SK, hint);
    this._hasHint.set(true);
  }

  /**
   * Called after a page reload when the session is still valid but the in-memory
   * key was lost. Returns true if the password matches the stored hint.
   */
  async unlockWithPassword(password: string, email: string): Promise<boolean> {
    const stored = sessionStorage.getItem(HINT_SK);
    if (!stored) return false;
    const hint = await this._hmacHint(password, email);
    if (hint !== stored) return false;
    await this.deriveKey(password, email);
    return true;
  }

  /** Wipes the in-memory key and the sessionStorage hint on logout */
  clearKey(): void {
    this._key.set(null);
    this._hasHint.set(false);
    sessionStorage.removeItem(HINT_SK);
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
      const combined  = Uint8Array.from(atob(cipherText.slice(ZK_PREFIX.length)), c => c.charCodeAt(0));
      const plainBuf  = await crypto.subtle.decrypt(
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

  /**
   * Returns a shallow copy of `record` with the listed fields encrypted.
   * Arrays and numbers are JSON-serialised before encryption so they
   * round-trip correctly through `decryptFields`.
   */
  async encryptFields<T extends Record<string, any>>(record: T, fields: string[]): Promise<T> {
    if (!this._key() || !fields.length) return record;
    const result = { ...record } as Record<string, any>;
    await Promise.all(fields.map(async field => {
      const val = result[field];
      if (val == null || val === '') return;
      if (this.isEncryptedValue(val)) return;   // already encrypted
      const plaintext = typeof val === 'string' ? val : JSON.stringify(val);
      result[field] = await this.encrypt(plaintext);
    }));
    return result as T;
  }

  /**
   * Returns a shallow copy of `record` with the listed `zk1:` fields decrypted.
   * JSON arrays/objects are parsed back to their original type.
   */
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

  /**
   * Encrypts a record AND each encounter inside it (encounters share the same field list).
   */
  async encryptRecord<T extends Record<string, any>>(record: T, entityKey: string): Promise<T> {
    const fields = this.getEncryptedFields(entityKey);
    return this.encryptFields(record, fields);
  }

  /**
   * Decrypts a record AND each encounter object inside `record.encounters`.
   */
  async decryptRecord<T extends Record<string, any>>(record: T, entityKey: string): Promise<T> {
    const fields  = this.getEncryptedFields(entityKey);
    const result  = await this.decryptFields(record, fields);
    const encs    = (result as any)['encounters'];
    if (Array.isArray(encs)) {
      (result as any)['encounters'] = await Promise.all(
        encs.map((e: Record<string, any>) => this.decryptFields(e, fields))
      );
    }
    return result;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async _pbkdf2(password: string, email: string): Promise<CryptoKey> {
    const enc  = new TextEncoder();
    const salt = await crypto.subtle.digest('SHA-256', enc.encode(email.toLowerCase().trim()));
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,               // non-extractable: key bytes never leave Web Crypto
      ['encrypt', 'decrypt']
    );
  }

  /** HMAC-SHA-256 of (email) signed with password — stored as verification hint */
  private async _hmacHint(password: string, email: string): Promise<string> {
    const enc = new TextEncoder();
    const k   = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', k, enc.encode(`dairi:zk:${email.toLowerCase().trim()}`));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  }
}
