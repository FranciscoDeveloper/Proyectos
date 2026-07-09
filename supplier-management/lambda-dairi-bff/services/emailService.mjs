// Email content builders and the presupuesto send workflow.
// No transport concerns live here — the BFF runs in VPC and cannot call
// Lambda/SES directly, so sendPresupuestoEmail returns the payload for the
// frontend to deliver.

import { getLogger } from '../lib/logger.mjs';
import { response }   from '../lib/response.mjs';

const APP_URL = process.env.APP_URL || 'https://dairi.cl';

// ── Formatting helpers ────────────────────────────────────────────────────────

function clp(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })
    .format(Math.round(n || 0));
}

function previsionLabel(v) {
  return { particular: 'Particular', fonasa: 'FONASA', isapre: 'Isapre', capredena: 'CAPREDENA' }[v] ?? v;
}

function calcPresupuestoTotals(p) {
  const subtotal    = (p.items || []).reduce((s, i) => s + (i.subtotal || 0), 0);
  const discount    = subtotal * ((p.discountGlobal || 0) / 100);
  const total       = subtotal - discount;
  const covered     = total * ((p.coveragePercent || 0) / 100);
  const patientPays = total - covered;
  return { subtotal, discount, total, covered, patientPays };
}

// ── Activation email ──────────────────────────────────────────────────────────

export function buildActivationEmail({ name, email, activationUrl }) {
  const firstName = name.split(' ')[0];
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1.5px solid #bae6fd;overflow:hidden;max-width:100%;">
<tr><td style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);padding:28px 40px;">
<h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;">Dairi<span style="color:#bae6fd;">.</span></h1>
</td></tr>
<tr><td style="padding:36px 40px;">
<h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Hola, ${firstName}</h2>
<p style="margin:0 0 24px;color:#475569;font-size:15px;">Tu cuenta en Dairi está lista. Actívala haciendo clic en el siguiente botón:</p>
<div style="text-align:center;margin:32px 0;">
<a href="${activationUrl}" style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">Activar cuenta</a>
</div>
<p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">Este enlace expira en 24 horas. Si no creaste esta cuenta, puedes ignorar este mensaje.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { to: email, subject: 'Activa tu cuenta en Dairi', html };
}

// ── Presupuesto email builders ────────────────────────────────────────────────

function buildTotalsHtml(t, p) {
  const rows = [];
  if (p.discountGlobal > 0) {
    rows.push(`<tr><td style="padding:7px 12px;color:#64748b;">Subtotal</td><td style="padding:7px 12px;text-align:right;">${clp(t.subtotal)}</td></tr>`);
    rows.push(`<tr><td style="padding:7px 12px;color:#f59e0b;">Descuento global (${p.discountGlobal}%)</td><td style="padding:7px 12px;text-align:right;color:#f59e0b;">-${clp(t.discount)}</td></tr>`);
  }
  rows.push(`<tr style="background:#f0f9ff;"><td style="padding:10px 12px;font-weight:800;color:#0c2d48;font-size:15px;">Total</td><td style="padding:10px 12px;text-align:right;font-weight:800;color:#0c2d48;font-size:15px;">${clp(t.total)}</td></tr>`);
  if (t.covered > 0) {
    rows.push(`<tr><td style="padding:7px 12px;color:#3b82f6;">${previsionLabel(p.prevision)} (${p.coveragePercent}%)</td><td style="padding:7px 12px;text-align:right;color:#3b82f6;">-${clp(t.covered)}</td></tr>`);
    rows.push(`<tr style="background:#dcfce7;"><td style="padding:10px 12px;font-weight:800;color:#15803d;">Pago Paciente</td><td style="padding:10px 12px;text-align:right;font-weight:800;color:#15803d;">${clp(t.patientPays)}</td></tr>`);
  }
  return `<table cellpadding="0" cellspacing="0" style="margin-left:auto;min-width:280px;border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;margin-bottom:8px;">${rows.join('')}</table>`;
}

function buildPresupuestoHtml(p, mode, customMessage) {
  const t          = calcPresupuestoTotals(p);
  const firstName  = (p.patientName || 'Paciente').split(' ')[0];
  const headerStyle = `background:linear-gradient(135deg,#0ea5e9,#06b6d4);padding:28px 40px;`;
  const bodyStyle   = `padding:32px 40px;`;

  const greeting = customMessage
    ? `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${customMessage.replace(/\n/g, '<br>')}</p>`
    : `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">
        Estimado/a <strong>${firstName}</strong>, le enviamos el presupuesto <strong>${p.numero}</strong>
        preparado por <strong>${p.doctorName}</strong>${p.specialty ? ` (${p.specialty})` : ''}.
       </p>`;

  let contentHtml = '';

  if (mode === 'completo') {
    const itemRows = (p.items || []).map(i => `
      <tr>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;">${i.description}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;text-align:center;">${i.quantity}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;text-align:right;">${clp(i.unitPrice)}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;text-align:center;">${i.discountPct > 0 ? i.discountPct + '%' : '—'}</td>
        <td style="padding:8px 10px;border-top:1px solid #e2e8f0;text-align:right;font-weight:600;">${clp(i.subtotal)}</td>
      </tr>`).join('');

    contentHtml = `
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:16px;">
        <thead>
          <tr style="background:#f0f9ff;">
            <th style="padding:8px 10px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px;">Descripción</th>
            <th style="padding:8px 10px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;">Cant.</th>
            <th style="padding:8px 10px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;">P. Unit.</th>
            <th style="padding:8px 10px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;">Dto.</th>
            <th style="padding:8px 10px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      ${buildTotalsHtml(t, p)}`;
  } else if (mode === 'total') {
    contentHtml = `
      <table cellpadding="0" cellspacing="0" style="margin:20px auto;border:1.5px solid #bae6fd;border-radius:10px;overflow:hidden;min-width:260px;">
        <tr style="background:#0ea5e9;">
          <td style="padding:14px 28px;color:#fff;font-size:14px;font-weight:700;text-align:center;">Total del Presupuesto</td>
        </tr>
        <tr>
          <td style="padding:18px 28px;font-size:26px;font-weight:900;color:#0c2d48;text-align:center;background:#f0f9ff;">${clp(t.total)}</td>
        </tr>
        ${t.covered > 0 ? `<tr><td style="padding:10px 28px;font-size:13px;color:#15803d;text-align:center;background:#dcfce7;">Pago estimado paciente (${previsionLabel(p.prevision)} ${p.coveragePercent}%): <strong>${clp(t.patientPays)}</strong></td></tr>` : ''}
      </table>`;
  } else {
    contentHtml = `
      <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:20px 24px;text-align:center;margin:16px 0;">
        <p style="margin:0;color:#0c2d48;font-size:15px;">Su presupuesto está listo.</p>
        <p style="margin:8px 0 0;color:#64748b;font-size:13px;">Para consultar los detalles, contáctenos directamente.</p>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1.5px solid #bae6fd;overflow:hidden;max-width:100%;">
        <tr>
          <td style="${headerStyle}">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;letter-spacing:-1px;">Dairi<span style="color:#bae6fd;">.</span></h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Plataforma clínica inteligente</p>
          </td>
        </tr>
        <tr>
          <td style="${bodyStyle}">
            <div style="display:inline-block;background:#dbeafe;color:#1d4ed8;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;margin-bottom:16px;">
              Presupuesto ${p.numero}
            </div>
            <h2 style="margin:0 0 16px;color:#0c2d48;font-size:20px;font-weight:800;">Hola, ${firstName} 👋</h2>
            ${greeting}
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:#475569;">
              <strong style="color:#0c2d48;">Profesional:</strong> ${p.doctorName}${p.specialty ? ` · ${p.specialty}` : ''}<br>
              <strong style="color:#0c2d48;">Previsión:</strong> ${previsionLabel(p.prevision)}<br>
              <strong style="color:#0c2d48;">Fecha emisión:</strong> ${p.fechaEmision}<br>
              <strong style="color:#0c2d48;">Válido hasta:</strong> <span style="color:#c2410c;">${p.fechaVencimiento}</span>
            </div>
            ${contentHtml}
            ${p.notes ? `<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:12px;"><strong>Observaciones:</strong> ${p.notes}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e0f2fe;padding:18px 40px;background:#f8fafc;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Este presupuesto fue generado en <a href="${APP_URL}" style="color:#0ea5e9;">Dairi</a> — Plataforma clínica inteligente.
              Para consultas, responde este email o contáctanos directamente.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPresupuestoText(p, mode, customMessage) {
  const t = calcPresupuestoTotals(p);
  const lines = [
    `Presupuesto ${p.numero} — Dairi`,
    ``,
    customMessage || `Estimado/a ${p.patientName}, le enviamos su presupuesto ${p.numero}.`,
    ``,
    `Profesional: ${p.doctorName}${p.specialty ? ` (${p.specialty})` : ''}`,
    `Previsión: ${previsionLabel(p.prevision)}`,
    `Emisión: ${p.fechaEmision}  |  Válido hasta: ${p.fechaVencimiento}`,
    ``
  ];
  if (mode === 'completo') {
    lines.push('--- Ítems del Presupuesto ---');
    (p.items || []).forEach(i => {
      lines.push(`${i.description} × ${i.quantity} = ${clp(i.subtotal)}${i.discountPct > 0 ? ` (${i.discountPct}% dcto.)` : ''}`);
    });
    lines.push('');
    if (p.discountGlobal > 0) lines.push(`Subtotal: ${clp(t.subtotal)}  |  Descuento global (${p.discountGlobal}%): -${clp(t.discount)}`);
    lines.push(`TOTAL: ${clp(t.total)}`);
    if (t.covered > 0) {
      lines.push(`${previsionLabel(p.prevision)} cubre (${p.coveragePercent}%): -${clp(t.covered)}`);
      lines.push(`PAGO PACIENTE: ${clp(t.patientPays)}`);
    }
  } else if (mode === 'total') {
    lines.push(`Total del presupuesto: ${clp(t.total)}`);
    if (t.covered > 0) lines.push(`Pago estimado paciente: ${clp(t.patientPays)}`);
  } else {
    lines.push('Su presupuesto está listo. Contáctenos para más detalles.');
  }
  if (p.notes) { lines.push(''); lines.push(`Observaciones: ${p.notes}`); }
  lines.push(''); lines.push(`— Equipo Dairi | ${APP_URL}`);
  return lines.join('\n');
}

// ── Presupuesto send workflow ─────────────────────────────────────────────────

/**
 * Build and return the email payload for a presupuesto.
 * Updates status from 'draft' → 'sent' as a side effect.
 * The BFF cannot invoke Lambda/SES from VPC, so it returns the payload
 * for the frontend to deliver.
 *
 * @param {import('pg').PoolClient} client
 * @param {import('../config/entities.mjs').ENTITY_CONFIG} entityConfig
 * @param {string|number} id  Presupuesto primary key.
 * @param {object} body       { to, mode?, message? }
 */
export async function sendPresupuestoEmail(client, entityConfig, id, body) {
  const log = getLogger();
  const { to, mode = 'completo', message = '' } = body ?? {};

  if (!to || !to.includes('@'))
    return response(400, { message: 'Email destinatario inválido' });

  if (!id)
    return response(400, { message: 'ID de presupuesto requerido' });

  const result = await client.query(`SELECT * FROM presupuesto WHERE id = $1 LIMIT 1`, [id]);
  if (result.rowCount === 0)
    return response(404, { message: 'Presupuesto no encontrado' });

  const p       = entityConfig.fromDb(result.rows[0]);
  const subject = `Presupuesto ${p.numero} — Dairi`;
  const html    = buildPresupuestoHtml(p, mode, message);
  const text    = buildPresupuestoText(p, mode, message);

  const newStatus = p.status === 'draft' ? 'sent' : p.status;
  if (p.status === 'draft') {
    await client.query(`UPDATE presupuesto SET status = 'sent', updated_at = NOW() WHERE id = $1`, [id]);
  }

  log.info('Presupuesto email payload built', { presupuestoId: id, to, mode });
  return response(200, {
    message:      'Presupuesto listo para envío.',
    emailSent:    false,
    newStatus,
    emailPayload: { to, subject, html, text },
  });
}
