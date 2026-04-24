import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface WebAuthnCredentialInfo {
  credentialId: string;
  deviceName:   string;
  deviceType:   string;
  createdAt:    string;
  lastUsedAt:   string | null;
}

export interface RegisterResult {
  success:    boolean;
  prfEnabled: boolean; // true → ZK key was derived via PRF (no certificate needed)
  prfKey?:    CryptoKey;
  error?:     string;
}

export interface AuthenticateResult {
  success:  boolean;
  prfKey?:  CryptoKey;  // present when PRF extension returned output
  error?:   string;
}

@Injectable({ providedIn: 'root' })
export class WebAuthnService {
  private http = inject(HttpClient);

  readonly isSupported = signal(
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials
  );

  /** Salt used for PRF-based ZK key derivation — must match backend PRF_ZK_SALT */
  private readonly PRF_ZK_LABEL = 'dairi-zk-prf-salt-v1';

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Registers the current device's biometric authenticator.
   * Requires the user to already be logged in (JWT needed).
   * Returns the PRF-derived ZK CryptoKey if the authenticator supports PRF.
   */
  async register(email: string, deviceName = 'Mi dispositivo'): Promise<RegisterResult> {
    if (!this.isSupported()) return { success: false, prfEnabled: false, error: 'WebAuthn no soportado en este navegador.' };

    try {
      // 1. Get registration options from server
      const opts = await firstValueFrom(
        this.http.post<any>('/api/auth/webauthn/register/begin', { email })
      );

      // 2. Build PublicKeyCredentialCreationOptions
      const prfSalt = this._labelToBytes(this.PRF_ZK_LABEL + ':' + email);

      const creationOptions: PublicKeyCredentialCreationOptions = {
        challenge:            this._b64urlToBuffer(opts.challenge),
        rp:                   opts.rp,
        user: {
          id:          this._b64urlToBuffer(opts.user.id),
          name:        opts.user.name,
          displayName: opts.user.displayName
        },
        pubKeyCredParams:     opts.pubKeyCredParams,
        authenticatorSelection: opts.authenticatorSelection,
        timeout:              opts.timeout ?? 60000,
        attestation:          'none',
        excludeCredentials:   (opts.excludeCredentials ?? []).map((c: any) => ({
          ...c, id: this._b64urlToBuffer(c.id)
        })),
        extensions: {
          prf: { eval: { first: prfSalt } }
        } as any
      };

      // 3. Prompt user for biometric (OS dialog)
      const credential = await navigator.credentials.create({ publicKey: creationOptions }) as PublicKeyCredential;
      if (!credential) return { success: false, prfEnabled: false, error: 'Registro cancelado.' };

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;
      const extResults          = credential.getClientExtensionResults() as any;

      // 4. Extract PRF output if available (for ZK key derivation)
      let prfKey: CryptoKey | undefined;
      let prfEnabled = false;
      const prfOutput = extResults?.prf?.results?.first;
      if (prfOutput) {
        prfKey     = await this._deriveCryptoKey(prfOutput);
        prfEnabled = true;
      }

      // 5. Send attestation to server for verification + storage
      const payload = {
        deviceName,
        credential: {
          id:                     credential.id,
          rawId:                  this._bufferToB64url(credential.rawId),
          type:                   credential.type,
          authenticatorAttachment: (credential as any).authenticatorAttachment,
          clientExtensionResults: { prf: { enabled: prfEnabled } },
          response: {
            attestationObject: this._bufferToB64url(attestationResponse.attestationObject),
            clientDataJSON:    this._bufferToB64url(attestationResponse.clientDataJSON),
            transports:        attestationResponse.getTransports?.() ?? ['internal']
          }
        }
      };

      await firstValueFrom(
        this.http.post('/api/auth/webauthn/register/complete', payload)
      );

      return { success: true, prfEnabled, prfKey };

    } catch (err: any) {
      return { success: false, prfEnabled: false, error: this._humanError(err) };
    }
  }

  // ── Authentication ────────────────────────────────────────────────────────

  /**
   * Authenticates using the registered biometric.
   * Returns the JWT-bearing AuthResponse (same shape as password login).
   * If PRF is supported, also returns the ZK CryptoKey.
   */
  async authenticate(email: string): Promise<{ authResponse?: any } & AuthenticateResult> {
    if (!this.isSupported()) return { success: false, error: 'WebAuthn no soportado.' };

    try {
      // 1. Get assertion options from server
      const opts = await firstValueFrom(
        this.http.post<any>('/api/auth/webauthn/login/begin', { email })
      );

      // 2. Build PublicKeyCredentialRequestOptions
      const prfSalt = this._labelToBytes(this.PRF_ZK_LABEL + ':' + email);

      const requestOptions: PublicKeyCredentialRequestOptions = {
        challenge:        this._b64urlToBuffer(opts.challenge),
        rpId:             opts.rpId,
        allowCredentials: (opts.allowCredentials ?? []).map((c: any) => ({
          ...c, id: this._b64urlToBuffer(c.id)
        })),
        userVerification: 'required',
        timeout:          opts.timeout ?? 60000,
        extensions: {
          prf: { eval: { first: prfSalt } }
        } as any
      };

      // 3. Prompt user for biometric
      const credential = await navigator.credentials.get({ publicKey: requestOptions }) as PublicKeyCredential;
      if (!credential) return { success: false, error: 'Autenticación cancelada.' };

      const assertionResponse = credential.response as AuthenticatorAssertionResponse;
      const extResults        = credential.getClientExtensionResults() as any;

      // 4. Extract PRF output if available
      let prfKey: CryptoKey | undefined;
      const prfOutput = extResults?.prf?.results?.first;
      if (prfOutput) {
        prfKey = await this._deriveCryptoKey(prfOutput);
      }

      // 5. Send assertion to server
      const payload = {
        email,
        credential: {
          id:   credential.id,
          type: credential.type,
          response: {
            authenticatorData: this._bufferToB64url(assertionResponse.authenticatorData),
            clientDataJSON:    this._bufferToB64url(assertionResponse.clientDataJSON),
            signature:         this._bufferToB64url(assertionResponse.signature),
            userHandle:        assertionResponse.userHandle
              ? this._bufferToB64url(assertionResponse.userHandle)
              : null
          }
        }
      };

      const authResponse = await firstValueFrom(
        this.http.post<any>('/api/auth/webauthn/login/complete', payload)
      );

      return { success: true, authResponse, prfKey };

    } catch (err: any) {
      return { success: false, error: this._humanError(err) };
    }
  }

  // ── Credential management ─────────────────────────────────────────────────

  async deleteCredential(credentialId: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`/api/auth/webauthn/credential/${encodeURIComponent(credentialId)}`));
      return true;
    } catch { return false; }
  }

  // ── PRF helpers ───────────────────────────────────────────────────────────

  /**
   * Imports raw PRF output bytes as a non-extractable AES-256-GCM CryptoKey.
   * This key is identical every time the same authenticator runs PRF with the same salt.
   */
  private async _deriveCryptoKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
    // Derive using HKDF so the AES key has proper entropy even if PRF output is short
    const hkdfKey = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {
        name:   'HKDF',
        hash:   'SHA-256',
        salt:   new TextEncoder().encode('dairi-zk-key-v1'),
        info:   new TextEncoder().encode('aes-gcm-256')
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,   // non-extractable
      ['encrypt', 'decrypt']
    );
  }

  // ── Encoding helpers ──────────────────────────────────────────────────────

  private _b64urlToBuffer(b64url: string): ArrayBuffer {
    const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad    = padded.length % 4;
    const b64    = pad ? padded + '='.repeat(4 - pad) : padded;
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  }

  _bufferToB64url(buf: ArrayBuffer | Uint8Array): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private _labelToBytes(label: string): ArrayBuffer {
    return new TextEncoder().encode(label).buffer;
  }

  private _humanError(err: any): string {
    const name = err?.name ?? '';
    if (name === 'NotAllowedError')   return 'Autenticación cancelada o denegada por el usuario.';
    if (name === 'InvalidStateError') return 'Este dispositivo ya está registrado.';
    if (name === 'NotSupportedError') return 'Este dispositivo no soporta autenticación biométrica.';
    if (name === 'SecurityError')     return 'Error de seguridad — la página debe servirse sobre HTTPS.';
    if (name === 'AbortError')        return 'Operación cancelada.';
    return err?.message ?? 'Error desconocido en autenticación biométrica.';
  }
}
