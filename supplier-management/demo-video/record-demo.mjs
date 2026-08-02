/**
 * Dairi – Demo Video Recorder
 *
 * Graba un recorrido completo de la aplicación usando Playwright
 * y convierte el resultado a MP4 con ffmpeg.
 *
 * Uso:
 *   node record-demo.mjs [--url http://localhost:4200] [--out ./output]
 *
 * Requiere:
 *   - Playwright  → npm install -g playwright (o NODE_PATH del global)
 *   - ffmpeg      → /opt/pw-browsers/ffmpeg-1011/ffmpeg-linux
 *   - App corriendo en BASE_URL
 */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync }  from 'child_process';
import { createHmac } from 'crypto';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Config ────────────────────────────────────────────────────────────────────
const __dir    = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.DEMO_URL  || 'http://localhost:4200';
const OUT_DIR  = process.env.DEMO_OUT  || join(__dir, 'output');
// ffmpeg-static tiene libx264; el bundleado de Playwright solo tiene VP8
const FFMPEG   = process.env.FFMPEG_BIN
  || '/opt/node22/lib/node_modules/ffmpeg-static/ffmpeg';
const EMAIL    = 'doctor@clinica.com';
const PASSWORD = 'demo123';
const W = 1280, H = 720;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ── Auth injection helpers ─────────────────────────────────────────────────────

/** Genera un JWT firmado con el secreto de la app (30 días de vigencia) */
function buildJWT() {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp     = Math.floor(Date.now() / 1000) + 86400 * 30;
  const payload = Buffer.from(JSON.stringify({ sub: '4', email: EMAIL, role: 'admin', exp })).toString('base64url');
  const sig     = createHmac('sha256', 'dairi-secret-key-2026').update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

/**
 * Construye el AuthState que se inyectará en sessionStorage.
 *
 * - schemas con key = clinicalRecords → SchemaService lo mapea a 'clinical-records'
 *   via KEY_ALIASES, habilitando el catálogo local con datos mock.
 * - Incluir 'patients' permite que la ruta /app/entity/patients pase el authGuard.
 * - 'clinicalRecords' activa hasRecords=true en el ShellComponent →
 *   agrega automáticamente Reportes y Presupuestos al menú de navegación.
 */
function buildAuthState() {
  return {
    authenticated: true,
    token: buildJWT(),
    user: {
      id: 4, name: 'Dra. Morales', email: EMAIL,
      role: 'admin', avatar: '', professionalId: null, professionalName: null
    },
    schemas: [
      {
        entity: {
          key: 'appointments', singular: 'Cita', plural: 'Citas',
          icon: 'calendar', moduleType: 'calendar',
          description: 'Agenda de citas médicas',
          encounterEntity: 'clinical-records', encounterMatchField: 'patientName'
        },
        fields: []
      },
      {
        entity: {
          key: 'clinicalRecords', singular: 'Paciente', plural: 'Fichas Clínicas',
          icon: 'clipboard', moduleType: 'clinical-record',
          description: 'Fichas clínicas', disableCreate: true
        },
        fields: []
      },
      {
        entity: {
          key: 'patients', singular: 'Paciente', plural: 'Pacientes',
          icon: 'heart', description: 'Registro de pacientes'
        },
        fields: []
      },
      {
        entity: {
          key: 'presupuestos', singular: 'Presupuesto', plural: 'Presupuestos',
          icon: 'file-text', moduleType: 'presupuestos', description: 'Presupuestos'
        },
        fields: []
      }
    ],
    zkEnabled: false,
    _v: 17
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Inyecta cursor visual sobre la página (visible en headless) */
async function injectCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById('__dmcursor')) return;
    const el = document.createElement('div');
    el.id = '__dmcursor';
    el.style.cssText = [
      'position:fixed', 'width:20px', 'height:20px',
      'border-radius:50%', 'background:rgba(99,102,241,0.78)',
      'border:2.5px solid rgba(255,255,255,0.9)',
      'pointer-events:none', 'z-index:2147483647',
      'left:-100px', 'top:-100px',
      'transform:translate(-50%,-50%)',
      'box-shadow:0 2px 14px rgba(99,102,241,0.55)',
      'transition:left 0.06s ease,top 0.06s ease'
    ].join(';');
    document.documentElement.appendChild(el);
  });
}

/** Mueve el cursor real Y el overlay visual */
async function move(page, x, y) {
  await page.mouse.move(x, y, { steps: 12 });
  await page.evaluate(([x, y]) => {
    const el = document.getElementById('__dmcursor');
    if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
  }, [x, y]);
}

/** Click con feedback visual (cursor parpadeante) */
async function click(page, selector, opts = {}) {
  const el = await page.waitForSelector(selector, { timeout: 8000 });
  const box = await el.boundingBox();
  if (box) {
    const cx = box.x + box.width  / 2;
    const cy = box.y + box.height / 2;
    await move(page, cx, cy);
    // Efecto de click: achica el cursor
    await page.evaluate(() => {
      const c = document.getElementById('__dmcursor');
      if (c) { c.style.transform = 'translate(-50%,-50%) scale(0.6)'; }
    });
    await sleep(120);
    await page.evaluate(() => {
      const c = document.getElementById('__dmcursor');
      if (c) { c.style.transform = 'translate(-50%,-50%) scale(1)'; }
    });
  }
  await el.click(opts);
}

/** Navega a una ruta y espera a que Angular cargue.
 *  La app usa HashLocationStrategy → las rutas son /#/ruta  */
async function goto(page, path) {
  await page.goto(`${BASE_URL}/#${path}`, { waitUntil: 'load', timeout: 30000 });
  // Esperar a que Angular haya renderizado el componente correspondiente
  await page.waitForFunction(
    () => {
      const root = document.querySelector('app-root');
      if (!root) return false;
      return root.children.length > 0 && root.textContent?.trim().length > 0;
    },
    { timeout: 30000, polling: 200 }
  );
  await sleep(900);
  await injectCursor(page);
}

/** Escribe en un campo con movimiento del cursor */
async function type(page, selector, text, delayMs = 60) {
  await click(page, selector);
  await page.fill(selector, '');
  await page.type(selector, text, { delay: delayMs });
}

/** Scroll suave */
async function scroll(page, y) {
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), y);
  await sleep(900);
}

// ── Demo scenes ───────────────────────────────────────────────────────────────

async function sceneLanding(page) {
  console.log('  🎬  Landing page');
  await goto(page, '/');
  await sleep(1500);
  // Mover el cursor por el hero
  await move(page, 640, 300);
  await sleep(800);
  // Scroll para mostrar features
  await scroll(page, 420);
  await sleep(800);
  await scroll(page, 780);
  await sleep(800);
  await scroll(page, 0);
  await sleep(700);
}

async function sceneLogin(page) {
  console.log('  🎬  Login');
  await goto(page, '/login');
  await page.waitForSelector('input[placeholder="usuario@empresa.com"]', { timeout: 20000 });
  await sleep(500);

  await type(page, 'input[placeholder="usuario@empresa.com"]', EMAIL,    55);
  await sleep(300);
  await type(page, 'input[placeholder="••••••••"]',            PASSWORD, 55);
  await sleep(600);

  // Mover cursor al botón de submit (efecto visual sin hacer la petición real)
  const btn = await page.$('button[type="submit"]');
  if (btn) {
    const box = await btn.boundingBox();
    if (box) await move(page, box.x + box.width / 2, box.y + box.height / 2);
  }
  await sleep(400);

  // Inyectar AuthState en sessionStorage y marcar onboarding completo en localStorage.
  // Esto ocurre ANTES del reload para que Angular lo lea al re-bootstrapearse.
  await page.evaluate(([stateJson, uid]) => {
    sessionStorage.setItem('auth_session', stateJson);
    localStorage.setItem(
      `dairi_onboarding_v1_${uid}`,
      JSON.stringify({ complete: true, completedAt: new Date().toISOString() })
    );
  }, [JSON.stringify(buildAuthState()), 4]);

  // Recarga completa: Angular se re-bootstrapea, lee el estado inyectado.
  // El guestGuard detecta usuario autenticado en /login y redirige a /app/dashboard.
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForFunction(
    () => window.location.hash.startsWith('#/app'),
    { timeout: 20000, polling: 300 }
  );
  await page.waitForFunction(
    () => {
      const root = document.querySelector('app-root');
      return root && root.children.length > 0 && root.textContent?.trim().length > 0;
    },
    { timeout: 20000, polling: 200 }
  );
  await sleep(1500);
  await injectCursor(page);
}

async function sceneDashboard(page) {
  console.log('  🎬  Dashboard');
  await goto(page, '/app/dashboard');
  await sleep(1500);
  await move(page, 400, 300);
  await sleep(600);
  await scroll(page, 350);
  await sleep(1200);
  await scroll(page, 0);
  await sleep(800);
}

async function sceneCalendar(page) {
  console.log('  🎬  Calendario de citas');
  await goto(page, '/app/module/appointments');
  await sleep(1800);
  // Hover sobre el grid
  await move(page, 700, 400);
  await sleep(600);
  // Navegar semana siguiente
  await click(page, '.nav-btn:last-of-type');
  await sleep(900);
  await click(page, '.nav-btn:last-of-type');
  await sleep(900);
  // Vista mes
  await click(page, '.view-toggle button:last-child');
  await sleep(1800);
  // Volver a semana
  await click(page, '.view-toggle button:nth-child(2)');
  await sleep(1200);
  // Vista día
  await click(page, '.view-toggle button:first-child');
  await sleep(1500);
  // Volver a semana
  await click(page, '.view-toggle button:nth-child(2)');
  await sleep(900);
}

async function scenePatients(page) {
  console.log('  🎬  Pacientes');
  await goto(page, '/app/entity/patients');
  await sleep(1500);
  // Mover sobre la lista
  await move(page, 640, 350);
  await sleep(500);
  // Buscar
  const searchInput = await page.$('input[type="text"], input[placeholder*="uscar"]');
  if (searchInput) {
    const box = await searchInput.boundingBox();
    if (box) {
      await move(page, box.x + box.width / 2, box.y + box.height / 2);
      await sleep(400);
      await searchInput.click();
      await page.type('input[type="text"], input[placeholder*="uscar"]', 'Gon', { delay: 100 });
      await sleep(1000);
      await searchInput.selectAll?.();
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Delete');
      await sleep(600);
    }
  }
  await scroll(page, 200);
  await sleep(1000);
  await scroll(page, 0);
  await sleep(700);
}

async function sceneClinical(page) {
  console.log('  🎬  Fichas clínicas');
  await goto(page, '/app/clinical/clinicalRecords');
  await sleep(1800);
  await move(page, 640, 350);
  await sleep(600);
  await scroll(page, 300);
  await sleep(1200);
  await scroll(page, 0);
  await sleep(800);
  // Intentar abrir la primera ficha si existe
  const firstRow = await page.$('.list-row, tr[class*="row"], .record-item, tbody tr');
  if (firstRow) {
    const box = await firstRow.boundingBox();
    if (box) {
      await move(page, box.x + 200, box.y + box.height / 2);
      await sleep(500);
      await firstRow.click();
      await sleep(2500);
      await scroll(page, 300);
      await sleep(1000);
    }
  }
}

async function sceneReports(page) {
  console.log('  🎬  Reportes');
  await goto(page, '/app/reports');
  await sleep(2000);
  await move(page, 640, 300);
  await sleep(600);
  await scroll(page, 400);
  await sleep(1500);
  // Clic en filtro "30 días" si existe
  const btn30 = await page.$('button:text("30"), button:text("30 días")');
  if (btn30) {
    const box = await btn30.boundingBox();
    if (box) await move(page, box.x + box.width / 2, box.y + box.height / 2);
    await sleep(400);
    await btn30.click();
    await sleep(1200);
  }
  await scroll(page, 0);
  await sleep(800);
}

async function sceneChat(page) {
  console.log('  🎬  Chat IA');
  await goto(page, '/app/chat');
  await sleep(1500);
  // Escribir un mensaje en el chat
  const input = await page.$('textarea, input[placeholder*="scribe"], input[placeholder*="regunta"], .chat-input');
  if (input) {
    const box = await input.boundingBox();
    if (box) await move(page, box.x + box.width / 2, box.y + box.height / 2);
    await sleep(500);
    await input.click();
    await page.type('textarea, .chat-input', '¿Cuántas citas tengo esta semana?', { delay: 65 });
    await sleep(1000);
    // No enviar para no consumir tokens
    await page.keyboard.press('Escape');
  }
  await sleep(1500);
}

async function scenePresupuestos(page) {
  console.log('  🎬  Presupuestos');
  await goto(page, '/app/presupuestos');
  await sleep(1800);
  await move(page, 640, 350);
  await sleep(600);
  await scroll(page, 300);
  await sleep(1200);
  await scroll(page, 0);
  await sleep(800);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎥  Dairi Demo Recorder');
  console.log('   URL     :', BASE_URL);
  console.log('   Salida  :', OUT_DIR);
  console.log('   Tamaño  :', `${W}×${H}`);
  console.log('');

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUT_DIR,
      size: { width: W, height: H }
    }
  });

  // slow_mo suave para que los clicks se vean naturales
  context.setDefaultTimeout(15000);
  const page = await context.newPage();

  try {
    await sceneLanding(page);
    await sceneLogin(page);
    await sceneDashboard(page);
    await sceneCalendar(page);
    await scenePatients(page);
    await sceneClinical(page);
    await sceneReports(page);
    await sceneChat(page);
    await scenePresupuestos(page);

    console.log('\n✅  Escenas grabadas. Cerrando navegador...');
  } catch (err) {
    console.error('\n❌  Error durante la grabación:', err.message);
  }

  await context.close();
  await browser.close();

  // ── Convertir WebM → MP4 ─────────────────────────────────────────────────
  const webms = readdirSync(OUT_DIR).filter(f => f.endsWith('.webm'));
  if (!webms.length) {
    console.error('❌  No se encontró archivo WebM en', OUT_DIR);
    process.exit(1);
  }

  const webm  = join(OUT_DIR, webms[0]);
  const mp4   = join(OUT_DIR, 'dairi-demo.mp4');
  console.log('\n🔄  Convirtiendo a MP4...');
  console.log('   Fuente  :', webm);
  console.log('   Destino :', mp4);

  execSync(
    `"${FFMPEG}" -y -i "${webm}" ` +
    `-vf "scale=${W}:${H}:flags=lanczos" ` +
    `-c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p ` +
    `-movflags +faststart "${mp4}"`,
    { stdio: 'inherit' }
  );

  // Limpiar el WebM intermedio
  readdirSync(OUT_DIR).filter(f => f.endsWith('.webm')).forEach(f => {
    renameSync(join(OUT_DIR, f), join(OUT_DIR, f.replace('.webm', '.webm.bak')));
  });

  console.log(`\n🎉  Video listo: ${mp4}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
