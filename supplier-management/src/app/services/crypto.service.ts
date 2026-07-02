import { Injectable, signal, computed } from '@angular/core';

const ZK_PREFIX        = 'zk1:';
const THUMB_SK         = 'zk_thumb';
const WRAPPED_KEY_SK   = 'zk_wrapped';   // AES-GCM(rawKey, passphrase-KEK)
const SALT_SK          = 'zk_salt';      // PBKDF2 salt for passphrase (base64)
const RC_KEY_PREFIX    = 'zk_rc_';       // zk_rc_0 … zk_rc_7 — recovery wrappers
const RC_SLOTS         = 8;

const PBKDF2_ITERS     = 200_000;  // passphrase (human-chosen, low entropy)
const RC_PBKDF2_ITERS  =  50_000;  // recovery codes (random 128-bit, high entropy)

// ── Helpers ───────────────────────────────────────────────────────────────────

function b64(u8: Uint8Array): string {
  return btoa(String.fromCharCode(...u8));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function fmtRecoveryCode(bytes: Uint8Array): string {
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${hex.slice(0,4)}-${hex.slice(4,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,24)}`;
}

function parseRecoveryCode(raw: string): Uint8Array {
  const hex = raw.replace(/[-\s]/g, '').toUpperCase();
  if (hex.length !== 24) throw new Error('bad_length');
  if (!/^[0-9A-F]{24}$/.test(hex)) throw new Error('bad_chars');
  return new Uint8Array(hex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
}

// ── Interfaces ────────────────────────────────────────────────────────────────

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

export const CHAT_ENCRYPTED_FIELDS     = ['content'];
export const SUPPLIER_ENCRYPTED_FIELDS = ENCRYPTED_FIELDS['suppliers'];

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private readonly _key            = signal<CryptoKey | null>(null);
  private readonly _hasThumb       = signal(!!localStorage.getItem(THUMB_SK));
  private readonly _hasWrappedKey  = signal(!!localStorage.getItem(WRAPPED_KEY_SK));

  // Holds raw key bytes temporarily during v1→v2 migration window only.
  // Cleared immediately after migrateToPassphrase() completes.
  private _migrationRawKey: Uint8Array | null = null;

  readonly isReady        = computed(() => !!this._key());
  readonly needsSetup     = computed(() => !this._hasThumb() && !this._key());
  readonly needsUnlock    = computed(() => this._hasThumb() && this._hasWrappedKey() && !this._key());
  // Legacy v1 users: have thumbprint but no wrapped key stored
  readonly needsMigration = computed(() => this._hasThumb() && !this._hasWrappedKey() && !this._key());

  // ── Public field helpers ──────────────────────────────────────────────────

  getEncryptedFields(entityKey: string): string[] {
    return ENCRYPTED_FIELDS[entityKey] ?? [];
  }

  isEncryptedField(entityKey: string, fieldName: string): boolean {
    return (ENCRYPTED_FIELDS[entityKey] ?? []).includes(fieldName);
  }

  isEncryptedValue(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith(ZK_PREFIX);
  }

  // ── Setup (new user) ──────────────────────────────────────────────────────

  /**
   * Generates a new AES-256-GCM key, wraps it with the passphrase using
   * PBKDF2 → AES-GCM, stores everything in localStorage, and also wraps the
   * same key with 8 random recovery codes stored alongside.
   *
   * Returns the 8 recovery codes to display to the user (only shown once).
   */
  async setup(email: string, passphrase: string): Promise<string[]> {
    const key    = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const thumb  = await this._thumbprint(rawKey);

    const codes = await this._storeKeyMaterial(rawKey, passphrase, thumb);

    const importedKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    this._key.set(importedKey);
    this._hasThumb.set(true);
    this._hasWrappedKey.set(true);

    return codes;
  }

  // ── Unlock: passphrase (normal daily flow) ────────────────────────────────

  /**
   * Derives the passphrase-based KEK from the stored salt, unwraps the
   * stored wrapped key, and activates the AES-GCM key in memory.
   */
  async unlockWithPassphrase(passphrase: string): Promise<boolean> {
    try {
      const saltB64    = localStorage.getItem(SALT_SK);
      const wrappedB64 = localStorage.getItem(WRAPPED_KEY_SK);
      if (!saltB64 || !wrappedB64) return false;

      const salt   = fromB64(saltB64);
      const kek    = await this._derivePassphraseKEK(passphrase, salt);
      const rawKey = await this._unwrapKey(wrappedB64, kek);

      const thumb  = await this._thumbprint(rawKey);
      const stored = localStorage.getItem(THUMB_SK);
      if (stored && thumb !== stored) return false;

      const importedKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      this._key.set(importedKey);
      return true;
    } catch {
      return false;
    }
  }

  // ── Unlock: recovery code ─────────────────────────────────────────────────

  /**
   * Tries each stored recovery-code slot with the derived KEK until one
   * succeeds. On success, sets a new passphrase and regenerates fresh
   * recovery codes.
   *
   * Returns the new recovery codes on success, null on failure.
   */
  async unlockWithRecoveryCode(code: string, newPassphrase: string): Promise<string[] | null> {
    try {
      const rcBytes = parseRecoveryCode(code);
      const thumb   = localStorage.getItem(THUMB_SK);
      if (!thumb) return null;

      const rcKek = await this._deriveRecoveryKEK(rcBytes, thumb);

      for (let i = 0; i < RC_SLOTS; i++) {
        const slot = localStorage.getItem(RC_KEY_PREFIX + i);
        if (!slot) continue;
        try {
          const rawKey      = await this._unwrapKey(slot, rcKek);
          const derivedThumb = await this._thumbprint(rawKey);
          if (derivedThumb !== thumb) continue;

          // Success — re-wrap with new passphrase and fresh recovery codes
          // Remove the used slot so users are aware a code was spent
          localStorage.removeItem(RC_KEY_PREFIX + i);

          const newCodes = await this._storeKeyMaterial(rawKey, newPassphrase, thumb);

          const importedKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
          this._key.set(importedKey);
          this._hasWrappedKey.set(true);
          return newCodes;
        } catch {
          continue;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // ── Migration: v1 (raw-key cert) → v2 (passphrase) ───────────────────────

  /**
   * Unlocks using a legacy v1 certificate (raw key in JSON).
   * Stores the raw key temporarily for migrateToPassphrase() to consume.
   */
  async unlockWithCertificateV1(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const cert = JSON.parse(text) as { type?: string; version?: number; key?: string };
      if (cert.type !== 'dairi-zk-certificate' || !cert.key) return false;

      const rawKey = fromB64(cert.key);
      const thumb  = await this._thumbprint(rawKey);
      const stored = localStorage.getItem(THUMB_SK);
      if (stored && thumb !== stored) return false;

      const importedKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      this._key.set(importedKey);
      this._migrationRawKey = rawKey;

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
   * Must be called right after a successful unlockWithCertificateV1().
   * Wraps the in-memory raw key with the new passphrase and stores
   * everything, completing the v1→v2 migration.
   */
  async migrateToPassphrase(passphrase: string): Promise<string[]> {
    const rawKey = this._migrationRawKey;
    if (!rawKey) throw new Error('No migration key available');
    this._migrationRawKey = null;

    const thumb = await this._thumbprint(rawKey);
    const codes = await this._storeKeyMaterial(rawKey, passphrase, thumb);
    this._hasWrappedKey.set(true);
    return codes;
  }

  // ── Key lifecycle ─────────────────────────────────────────────────────────

  clearKey(): void {
    this._key.set(null);
    this._migrationRawKey = null;
  }

  clearHint(): void {
    this._key.set(null);
    this._migrationRawKey = null;
    this._hasThumb.set(false);
    this._hasWrappedKey.set(false);
    localStorage.removeItem(THUMB_SK);
    localStorage.removeItem(WRAPPED_KEY_SK);
    localStorage.removeItem(SALT_SK);
    for (let i = 0; i < RC_SLOTS; i++) localStorage.removeItem(RC_KEY_PREFIX + i);
  }

  // ── Encrypt / Decrypt primitives ──────────────────────────────────────────

  async encrypt(plaintext: string): Promise<string> {
    const key = this._key();
    if (!key) return plaintext;

    const iv        = crypto.getRandomValues(new Uint8Array(12));
    const enc       = new TextEncoder();
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    const combined  = new Uint8Array(12 + cipherBuf.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(cipherBuf), 12);
    return ZK_PREFIX + b64(combined);
  }

  async decrypt(cipherText: string): Promise<string> {
    if (!this.isEncryptedValue(cipherText)) return cipherText;
    const key = this._key();
    if (!key) return '[🔒 cifrado]';

    try {
      const combined = fromB64(cipherText.slice(ZK_PREFIX.length));
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

  // ── Record-level helpers ──────────────────────────────────────────────────

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
    return this.encryptFields(record, this.getEncryptedFields(entityKey));
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

  // ── Private crypto helpers ────────────────────────────────────────────────

  private async _thumbprint(rawKey: Uint8Array): Promise<string> {
    const hashBuf = await crypto.subtle.digest('SHA-256', rawKey);
    return b64(new Uint8Array(hashBuf));
  }

  private async _derivePassphraseKEK(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async _deriveRecoveryKEK(rcBytes: Uint8Array, thumb: string): Promise<CryptoKey> {
    const salt = new TextEncoder().encode('dairi-rc-v1:' + thumb);
    const baseKey = await crypto.subtle.importKey('raw', rcBytes, 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: RC_PBKDF2_ITERS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async _wrapKey(rawKey: Uint8Array, kek: CryptoKey): Promise<string> {
    const iv      = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, rawKey);
    const combined = new Uint8Array(12 + wrapped.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(wrapped), 12);
    return b64(combined);
  }

  private async _unwrapKey(wrappedB64: string, kek: CryptoKey): Promise<Uint8Array> {
    const combined = fromB64(wrappedB64);
    const plain    = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) }, kek, combined.slice(12)
    );
    return new Uint8Array(plain);
  }

  /**
   * Persists all key material derived from rawKey:
   *   - passphrase-wrapped key + salt → localStorage
   *   - 8 recovery-code-wrapped keys → localStorage (zk_rc_0 … zk_rc_7)
   *   - thumbprint → localStorage
   *
   * Returns the 8 recovery codes as formatted strings (only copy ever shown).
   */
  private async _storeKeyMaterial(rawKey: Uint8Array, passphrase: string, thumb: string): Promise<string[]> {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const kek  = await this._derivePassphraseKEK(passphrase, salt);
    const wrappedKey = await this._wrapKey(rawKey, kek);

    const codes: string[] = [];
    for (let i = 0; i < RC_SLOTS; i++) {
      const rcBytes = crypto.getRandomValues(new Uint8Array(12));
      codes.push(fmtRecoveryCode(rcBytes));
      const rcKek    = await this._deriveRecoveryKEK(rcBytes, thumb);
      const rcWrapped = await this._wrapKey(rawKey, rcKek);
      localStorage.setItem(RC_KEY_PREFIX + i, rcWrapped);
    }

    localStorage.setItem(THUMB_SK, thumb);
    localStorage.setItem(WRAPPED_KEY_SK, wrappedKey);
    localStorage.setItem(SALT_SK, b64(salt));

    return codes;
  }
}
