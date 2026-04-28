import { Component, inject, signal, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';

function passwordMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pass    = ctrl.get('password')?.value;
  const confirm = ctrl.get('confirmPassword')?.value;
  return pass && confirm && pass !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);

  private readonly EMAIL_API = 'https://cwhwahvqr0.execute-api.us-east-1.amazonaws.com/api/send-email';

  readonly otpIndices = [0, 1, 2, 3, 4, 5];

  showPass      = signal(false);
  showConfirm   = signal(false);
  showTerms     = signal(false);
  loading       = signal(false);
  step          = signal<'form' | 'verify' | 'done'>('form');
  activationCode = signal('');
  codeDigits    = signal<string[]>(['', '', '', '', '', '']);
  codeError     = signal('');
  emailError    = signal('');
  resending     = signal(false);
  resendSent    = signal(false);

  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  form = this.fb.group({
    nombre:          ['', [Validators.required, Validators.minLength(2)]],
    apellidos:       ['', [Validators.required, Validators.minLength(2)]],
    email:           ['', [Validators.required, Validators.email]],
    telefono:        ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-]{7,15}$/)]],
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    termsAccepted:   [false, [Validators.requiredTrue]]
  }, { validators: passwordMatch });

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  get passwordMismatch(): boolean {
    return !!(this.form.hasError('passwordMismatch') && this.form.get('confirmPassword')?.touched);
  }

  get registeredEmail(): string {
    return this.form.get('email')?.value ?? '';
  }

  get registeredName(): string {
    return this.form.get('nombre')?.value ?? '';
  }

  togglePass()    { this.showPass.update(v => !v); }
  toggleConfirm() { this.showConfirm.update(v => !v); }

  openTerms(e: Event) {
    e.preventDefault();
    this.showTerms.set(true);
  }

  closeTerms() { this.showTerms.set(false); }

  acceptTerms() {
    this.form.get('termsAccepted')?.setValue(true);
    this.form.get('termsAccepted')?.markAsTouched();
    this.showTerms.set(false);
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private buildEmailHtml(code: string, nombre: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(14,165,233,.12);border:1.5px solid #bae6fd;">
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);padding:32px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;">Dairi<span style="color:#7dd3fc;">.</span></div>
            <div style="color:rgba(255,255,255,.75);font-size:13px;margin-top:4px;">Gestión Clínica Inteligente</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0c1a2e;">Hola, ${nombre} 👋</p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Gracias por registrarte en Dairi. Ingresa el siguiente código en la pantalla de verificación para activar tu cuenta:
            </p>
            <div style="text-align:center;margin:28px 0;">
              <div style="display:inline-block;background:#f0f9ff;border:2px solid #bae6fd;border-radius:16px;padding:20px 40px;">
                <div style="font-size:38px;font-weight:900;letter-spacing:10px;color:#0284c7;font-family:monospace;">${code}</div>
              </div>
              <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Este código expira en 15 minutos</p>
            </div>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
              Vuelve a la pantalla de registro e ingresa el código para completar la activación. Si no solicitaste este registro, ignora este correo.
            </p>
            <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:14px 16px;font-size:13px;color:#0369a1;line-height:1.5;">
              <strong>Tu período de prueba gratuito de 14 días</strong> comienza al activar la cuenta. Sin tarjeta de crédito requerida.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1.5px solid #e0f2fe;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Dairi · Servicios Informáticos Francisco Riquelme E.I.R.L. · Santiago, Chile<br>
              <a href="mailto:noreply@dairi.cl" style="color:#0ea5e9;text-decoration:none;">noreply@dairi.cl</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private async sendActivationEmail(code: string): Promise<void> {
    const res = await fetch(this.EMAIL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:      this.registeredEmail,
        subject: `${code} — Tu código de activación Dairi`,
        html:    this.buildEmailHtml(code, this.registeredName),
        from:    'noreply@dairi.cl'
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'Error al enviar el correo');
  }

  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.emailError.set('');
    try {
      const code = this.generateCode();
      await this.sendActivationEmail(code);
      this.activationCode.set(code);
      this.codeDigits.set(['', '', '', '', '', '']);
      this.codeError.set('');
      this.step.set('verify');
    } catch {
      this.emailError.set('No pudimos enviar el correo. Verifica tu dirección e intenta nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  onDigitInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val   = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    input.value = val;
    const digits = [...this.codeDigits()];
    digits[index] = val;
    this.codeDigits.set(digits);
    this.codeError.set('');
    if (val && index < 5) {
      this.digitInputs.toArray()[index + 1]?.nativeElement.focus();
    }
  }

  onDigitKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
      const digits = [...this.codeDigits()];
      if (!digits[index] && index > 0) {
        digits[index - 1] = '';
        this.codeDigits.set(digits);
        this.digitInputs.toArray()[index - 1]?.nativeElement.focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.digitInputs.toArray()[index - 1]?.nativeElement.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.digitInputs.toArray()[index + 1]?.nativeElement.focus();
    }
  }

  onCodePaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = (event.clipboardData?.getData('text') ?? '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const digits = text.padEnd(6, '').split('').slice(0, 6);
    this.codeDigits.set(digits);
    const inputs = this.digitInputs.toArray();
    inputs.forEach((el, i) => { el.nativeElement.value = digits[i]; });
    inputs[Math.min(text.length, 5)]?.nativeElement.focus();
    this.codeError.set('');
  }

  verifyCode() {
    const entered = this.codeDigits().join('');
    if (entered.length < 6) {
      this.codeError.set('Ingresa los 6 caracteres del código');
      return;
    }
    if (entered !== this.activationCode()) {
      this.codeError.set('El código no es válido. Revisa tu correo e intenta nuevamente.');
      return;
    }
    this.step.set('done');
  }

  async resendEmail() {
    this.resending.set(true);
    this.resendSent.set(false);
    this.codeError.set('');
    try {
      const code = this.generateCode();
      await this.sendActivationEmail(code);
      this.activationCode.set(code);
      this.codeDigits.set(['', '', '', '', '', '']);
      const inputs = this.digitInputs.toArray();
      inputs.forEach(el => { el.nativeElement.value = ''; });
      inputs[0]?.nativeElement.focus();
      this.resendSent.set(true);
      setTimeout(() => this.resendSent.set(false), 4000);
    } catch {
      this.codeError.set('No pudimos reenviar el correo. Intenta en unos minutos.');
    } finally {
      this.resending.set(false);
    }
  }
}
