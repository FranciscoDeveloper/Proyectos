# Dairi — Publicación en Google Play y App Store

> Runbook paso a paso para publicar la app móvil (Capacitor) de Dairi.
> Escrito para que lo siga **Francisco** sin conocimiento previo de publicación
> de apps, meses después de haberlo leído por primera vez.
>
> Está aterrizado en el estado **real** de este repositorio (revisión del
> 2026-08-05), no en instrucciones genéricas. Cada bloqueador que se menciona
> fue verificado en el código o en la configuración nativa.

---

## Datos de la app (ya definidos en el repo — no inventar otros)

| Dato | Valor | Dónde está definido |
|---|---|---|
| App ID / Bundle ID | `cl.dairi.app` | `capacitor.config.ts`, `android/app/build.gradle`, `project.pbxproj` |
| Nombre visible | `Dairi` | `android/.../values/strings.xml`, `Info.plist` (`CFBundleDisplayName`) |
| Web build dir | `dist/supplier-management/browser` | `capacitor.config.ts` (`webDir`) |
| versionCode (Android) | `1` | `android/app/build.gradle` |
| versionName (Android) | `1.0` | `android/app/build.gradle` |
| MARKETING_VERSION (iOS) | `1.0` | `ios/App/App.xcodeproj/project.pbxproj` |
| CURRENT_PROJECT_VERSION (iOS) | `1` | idem |
| minSdk / targetSdk | `24` / `36` | `android/variables.gradle` |
| Dispositivos iOS | iPhone **y iPad** (`TARGETED_DEVICE_FAMILY = "1,2"`) | `project.pbxproj` |

### Versiones de Node (crítico — el repo usa dos)

| Para qué | Versión |
|---|---|
| `ng build` / build Angular | **20.9.0** (`nvm use 20.9.0`) |
| Comandos `npx cap ...` | **22.22.3** (`nvm use 22.22.3`) |

Es `nvm-windows` (nvm4w). Si después de `nvm use` el comando `npm` no aparece en
el PATH dentro de una shell tipo bash, usar la ruta explícita
`"/c/nvm4w/nodejs/npm.cmd"`.

> **Si `nvm use` se queda colgado**: nvm-windows recrea el symlink
> `C:\nvm4w\nodejs` con una operación que puede quedar esperando un prompt de
> elevación (UAC) que nunca se responde. Si pasa, matar el proceso `nvm` y
> recrear el enlace a mano (un *junction* no requiere permisos de admin):
> ```powershell
> New-Item -ItemType Junction -Path "C:\nvm4w\nodejs" `
>          -Target "C:\Users\<usuario>\AppData\Local\nvm\v20.9.0"
> ```
> Para cambiar de versión, borrar el junction y recrearlo apuntando a `v22.22.3`.

---

# FASE 0 — Bloqueadores que hay que resolver ANTES de empezar

Ninguno de estos se puede saltar. Los tres primeros impiden técnicamente
publicar; los tres siguientes provocan rechazo o prometen algo que la app no
hace.

### [ ] 0.1 — `google-services.json` no existe (bloquea push en Android)

**Estado:** `android/app/google-services.json` **no está en el repo.**

`android/app/build.gradle` (líneas finales) aplica el plugin de Google Services
sólo si el archivo existe, y si no, deja este mensaje en el log:
`"google-services.json not found, google-services plugin not applied. Push Notifications won't work"`.
`@capacitor/push-notifications` en Android va sobre FCM, así que sin este archivo
el registro falla y `MobileService.pushError` queda con el error
(ver `src/app/services/mobile.service.ts`, listener `registrationError`).

**Cómo obtenerlo:**
1. Entrar a <https://console.firebase.google.com> con la cuenta Google de la empresa.
2. **Add project** → nombre `Dairi` (o reutilizar un proyecto existente).
   No hace falta habilitar Google Analytics.
3. Dentro del proyecto: **Add app → Android**.
4. **Android package name**: `cl.dairi.app` (exactamente; si no coincide, FCM no funciona).
5. Descargar el archivo `google-services.json` que ofrece el asistente.
6. Guardarlo en `supplier-management/android/app/google-services.json`.
7. Volver a compilar. El plugin se aplica solo.

> Este archivo **no es secreto** (va dentro del APK y es extraíble), pero
> igual conviene no publicarlo en un repo público.

### [ ] 0.2 — El keystore de firma no existe

**Estado:** `capacitor.config.ts` declara

```ts
android: { buildOptions: { keystorePath: 'dairi.keystore', keystoreAlias: 'dairi' } }
```

pero **no hay ningún `dairi.keystore` en el repositorio**, y tampoco están
declaradas las contraseñas. Sin él no se puede firmar un release.

**Generarlo** (requiere `keytool`, que viene con el JDK):

```bash
keytool -genkeypair -v \
  -keystore dairi.keystore \
  -alias dairi \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

Pide: contraseña del keystore, nombre y apellido, unidad organizativa,
organización, ciudad, región, código de país (`CL`). Anotar **todo**.

> ## ⚠️ ESTE ARCHIVO NO SE PUEDE PERDER NUNCA
>
> Google Play identifica la app por la clave con que se firma. Si se pierde el
> keystore **o su contraseña**, es **imposible** volver a publicar una
> actualización de `cl.dairi.app`: habría que publicar una app nueva, con otro
> package name, y pedirle a todos los usuarios que la instalen de cero,
> perdiendo instalaciones, reseñas y ranking.
>
> **Qué hacer con él:**
> - Copia en un gestor de contraseñas (1Password / Bitwarden) junto con las contraseñas.
> - Copia en un almacenamiento cifrado offline (pendrive guardado físicamente).
> - **NO** commitearlo al repositorio (añadir `*.keystore` y `*.jks` a `.gitignore`).
>
> Activar además **Play App Signing** (paso 2.6): Google guarda una copia de la
> clave de firma final, lo que da una red de seguridad si se pierde la clave de
> *upload*. Es la razón principal para usarlo.

Guardar el keystore fuera del repo (por ejemplo `C:\claves\dairi.keystore`) y
apuntar `keystorePath` a esa ruta absoluta, o pasar la ruta por línea de comandos
al firmar.

### [x] 0.3 — Eliminación de cuenta — ✅ RESUELTO (2026-08-05)

**Estado:** implementado, desplegado y probado end-to-end. Ya no bloquea el envío.

Cubre las dos reglas obligatorias: **Apple 5.1.1(v)** (borrado desde dentro de la
app) y la **política de eliminación de datos de Google Play** (borrado en la app
**más** una URL pública utilizable sin instalarla).

**Qué se construyó:**

| Pieza | Dónde |
|---|---|
| Endpoint | `DELETE /api/auth/account` — Lambda `login` (`lambda-auth/index.mjs`, `handleDeleteAccount`) |
| Ruta API Gateway | `cwhwahvqr0`, route id `b3848kp` → `integrations/tfm6c1r`; permiso `allow-apigw-delete-account` |
| Control **dentro de la app** (Apple) | `https://dairi.cl/#/app/cuenta` — botón ⚙ "Mi cuenta" en el pie de la barra lateral, junto a "Cerrar sesión" |
| **URL pública** (Play) | **`https://dairi.cl/#/eliminar-cuenta`** ← es la que va en el formulario de Play |
| Componentes | `src/app/components/account/`, `src/app/components/delete-account/` |

El endpoint está en `lambda-auth` y **no** en `dairi-bff` (como sugería la versión
anterior de esta nota): todo lo que destruye es estado de autenticación que esa
función ya administra — cuentas DynamoDB, refresh tokens y la fila `app_user`.

**Decisión de producto: "anonimizar y conservar", no borrado total.**
Dairi almacena registros clínicos sujetos a obligación legal de retención, así que
un borrado en cascada podría ser ilegal. Concretamente:

- **Se destruye** (el profesional no puede volver a entrar nunca):
  el ítem de cuenta en `dairi-accounts` / `dairi-agenda-accounts` (borrado real,
  no tombstone), todos sus refresh tokens (DynamoDB y Postgres), sus permisos de
  módulo (`user_schema`) y su configuración de cifrado (`user_config`).
- **Se anonimiza en su sitio** (la fila sobrevive, la identidad no):
  `app_user` (nombre/correo/contraseña/avatar) — no se borra porque `audit_log` y
  `data_request` tienen FK reales hacia ella; y `professional`
  (nombre → «Profesional eliminado», email/`booking_token`/`google_calendar_id`
  a NULL, `active` = false). `professional.id` **nunca** se borra.
- **Se conserva intacto**: `patient`, `clinical_record`, `appointment`,
  `presupuesto`, `payment`, `session` y `professional_rating`. Ningún dato de
  pacientes se toca.

Seguridad: la identidad sale **solo** del JWT verificado (`sub` + `email`); nunca
de un id en el body, así que no se puede borrar la cuenta de otro. Además se
re-verifica la contraseña en el servidor, de modo que un token de acceso robado no
basta. El endpoint es idempotente: repetirlo sobre una cuenta ya eliminada
devuelve 200, no 500.

> ⚠️ **Pendiente asociado (paso 1.1 y 2.8):** esta retención de registros clínicos
> anonimizados **hay que declararla** en la política de privacidad y en las fichas
> de Data Safety (Play) y App Privacy (Apple). El texto que ve el usuario al
> eliminar ya lo explica; las fichas de las tiendas todavía no.

> **Nota sobre RDS:** las cuentas de plan Pro/Enterprise necesitan que la base RDS
> esté encendida para completar la anonimización (si no, el endpoint responde 503 y
> no destruye nada, para que el reintento sea seguro). Las cuentas Starter/agenda
> viven 100 % en DynamoDB y se eliminan aunque RDS esté apagada. **Mantener la RDS
> encendida durante toda la revisión de las tiendas**, o un revisor que pruebe el
> borrado verá un error.

### [ ] 0.4 — Las notificaciones push no están terminadas (no prometerlas)

`src/app/services/mobile.service.ts` tiene `PUSH_TOKEN_DELIVERY_ENABLED = false`.
La app obtiene el token del dispositivo pero **nunca lo envía a un backend**,
porque no existe ni endpoint de almacenamiento ni un emisor (ni Firebase Admin
ni SNS) en ninguna Lambda.

**Consecuencia práctica:** hoy la app **no puede recibir** notificaciones push
reales. No mencionar "notificaciones" ni "recordatorios push" en la descripción
de la tienda ni en las capturas hasta que el circuito esté completo — describir
una función inexistente es causa de rechazo (Apple 2.3, "Accurate Metadata").

Alternativa: si no se va a completar antes del lanzamiento, considerar quitar el
permiso `POST_NOTIFICATIONS` del manifiesto para no tener que justificarlo.

### [ ] 0.5 — Google Calendar no funciona dentro de la app nativa

Documentado en `src/app/services/google-calendar.service.ts` (`canUseOAuth`).
El flujo OAuth por *popup* de Google Identity Services no puede completarse
dentro de un WebView, y además Google bloquea por política los WebViews
embebidos (`disallowed_useragent`). En nativo la app ya **oculta** el botón
"Conectar Google Calendar" y usa, en su lugar, la URL pública
`calendar.google.com/render` abierta en un navegador real.

**Para la ficha de la tienda:** la sincronización con Google Calendar existe en
la versión web; en la app móvil sólo está "añadir un evento al calendario".
Describirlo así, sin exagerar.

### [ ] 0.7 — Restaurar la configuración nativa al preparar un equipo nuevo

`supplier-management/.gitignore` ignora `/android/` y `/ios/` porque son
proyectos generados por Capacitor. Pero dentro de ellos hay **dos archivos
editados a mano** que `cap add` **no** regenera con nuestro contenido:

- `android/app/src/main/AndroidManifest.xml` → permisos `RECORD_AUDIO`,
  `MODIFY_AUDIO_SETTINGS`, `POST_NOTIFICATIONS`.
- `ios/App/App/Info.plist` → los textos `NS*UsageDescription`.

Sin ellos, **grabar la atención falla en todo Android** y **iOS cierra la app**
al tocar el micrófono o la cámara.

Las copias buenas están versionadas en `supplier-management/native-config/`.
**Esto afecta directamente al paso 3.3**: el Mac donde se compile iOS va a
clonar el repo y no tendrá el `Info.plist` correcto hasta restaurarlo.

```bash
cd supplier-management
cp native-config/android/AndroidManifest.xml android/app/src/main/AndroidManifest.xml
cp native-config/ios/Info.plist            ios/App/App/Info.plist
```

Ver `supplier-management/native-config/README.md`.

### [ ] 0.6 — Retirar la Lambda `db-access` antes del lanzamiento público

`CLAUDE.md` la describe como auxiliar de diagnóstico, **sin JWT**, y dice
explícitamente que "será eliminada cuando se venda el software".

Una Lambda sin autenticación con acceso a la base de datos de una app clínica es
un riesgo serio en cuanto la app sea pública y el tráfico deje de ser sólo
interno. **Eliminarla (o cerrarla tras autenticación) antes de publicar.** Si
llegara a filtrarse un incidente de datos de salud, su existencia sería difícil
de justificar ante cualquier auditoría.

---

# FASE 1 — Preparación común a ambas tiendas

### [ ] 1.1 — Política de privacidad (obligatoria en las dos tiendas)

No existe hoy ninguna ruta de privacidad en la app (`app.routes.ts` no tiene
`privacy` ni `privacidad`). Hay que **escribirla y publicarla en una URL pública
y estable** (p. ej. `https://dairi.cl/privacidad`), accesible sin login.

Como Dairi maneja **datos de salud**, la política debe decir, como mínimo:

- Qué datos se recogen: identificación del profesional, datos de pacientes
  (nombre, RUT, teléfono, email, diagnósticos, antecedentes), audio de las
  atenciones, documentos clínicos adjuntos.
- **Quién los procesa además de Dairi.** Esto es concreto en este repo:
  - **Deepgram** — recibe el audio de las atenciones para transcribirlo
    (`lambda-transcribe/handler.js`).
  - **AWS Bedrock** — recibe la transcripción para generar la nota SOAP.
  - **AWS** (S3, RDS, DynamoDB, Lambda) como infraestructura de alojamiento.
  Omitir los subprocesadores es un problema legal y también de la ficha de
  Data Safety.
- Base legal y consentimiento del paciente para grabar la atención.
- Cuánto tiempo se conservan los datos y cómo se eliminan. Debe describir el
  comportamiento real ya implementado (0.3): al eliminar la cuenta se destruye la
  identidad del profesional pero **se conservan los registros clínicos**, con los
  datos identificatorios del profesional sustituidos por «Profesional eliminado».
  Mencionar la URL pública `https://dairi.cl/#/eliminar-cuenta`.
- Cifrado: la app tiene un modo Zero-Knowledge (`src/app/services/crypto.service.ts`,
  AES-256-GCM con certificado en poder del usuario). Es un punto **a favor** y
  conviene explicarlo, aclarando que si el usuario pierde su certificado los
  datos cifrados son irrecuperables.
- Contacto del responsable de datos.

### [ ] 1.2 — Inventario de datos (te servirá para los dos formularios)

Rellenar esta tabla una vez y reutilizarla en Play Data Safety y en Apple App
Privacy, para que **no se contradigan** (las tiendas comparan, y una
contradicción con el comportamiento real de la app es motivo de retirada):

| Dato | ¿Se recoge? | ¿Se comparte con terceros? | Finalidad |
|---|---|---|---|
| Nombre / email del profesional | Sí | No | Cuenta y autenticación |
| Datos identificatorios de pacientes (nombre, RUT) | Sí | No | Funcionalidad de la app |
| Información de salud (diagnósticos, antecedentes, notas SOAP) | Sí | Sí — Bedrock (generación SOAP) | Funcionalidad de la app |
| Audio de la atención | Sí | Sí — Deepgram (transcripción) | Funcionalidad de la app |
| Fotos / documentos clínicos | Sí | No | Funcionalidad de la app |
| Datos de pago | Revisar `lambda-payment` antes de responder | — | — |

> Verificar la última fila mirando `lambda-payment` antes de enviar el
> formulario: si hay pasarela de pago, hay que declararla.

### [ ] 1.3 — Recursos gráficos

| Recurso | Play | App Store |
|---|---|---|
| Icono | 512×512 PNG (32-bit, con alfa) | 1024×1024 PNG (**sin** alfa, sin esquinas redondeadas) |
| Gráfico destacado | 1024×500 | — |
| Capturas teléfono | mín. 2, máx. 8 | 6.9" (o 6.7") obligatorio |
| Capturas tablet | Recomendado | **Obligatorio 13" iPad** (ver nota) |

> **Nota iPad:** el proyecto declara `TARGETED_DEVICE_FAMILY = "1,2"`, es decir
> iPhone **y** iPad. Con eso, Apple **exige** capturas de iPad y revisará la app
> en iPad. Si el layout no está probado en tablet, la opción más segura es
> cambiarlo a `"1"` (sólo iPhone) en Xcode y evitar toda esa categoría de
> rechazos.

> ⚠️ Las capturas **no pueden mostrar datos reales de pacientes**. Usar datos
> ficticios. Una captura con un RUT o un diagnóstico real sería una filtración
> de datos de salud.

### [ ] 1.4 — Cuenta de demostración para los revisores

Ambas tiendas revisan la app a mano y Dairi está **detrás de un login**, así que
sin credenciales el rechazo es automático ("no pudimos acceder al contenido").

Preparar una cuenta de prueba **con datos ficticios** y dejarla activa durante
toda la revisión:
- Usuario y contraseña, en Apple bajo *App Review Information → Sign-In Required*,
  y en Play bajo *App content → App access*.
- Si hay pasos que no son obvios (activación por email, onboarding, módulos que
  hay que habilitar), describirlos en las notas del revisor.
- La cuenta debe tener datos cargados: un revisor que entra a una app vacía no
  puede evaluar nada y suele rechazar.

---

# FASE 2 — Google Play (Android)

### [ ] 2.1 — Crear la cuenta de Google Play Console

1. <https://play.google.com/console> → registrarse.
2. **Cuota: US$25, pago único** (no es anual).
3. Elegir tipo de cuenta:
   - **Organización** (recomendado si Dairi es una empresa): pide un
     **D-U-N-S number**, que es gratis pero puede tardar días o semanas en
     emitirse. **Empezar este trámite pronto, es el que más demora.**
   - **Personal**: más rápido, pero ver el aviso del paso 2.9.
4. Verificación de identidad (documento) y, en cuentas de organización,
   verificación del dominio y del teléfono.

> Los datos que se pongan aquí (nombre del desarrollador, dirección de contacto)
> se muestran **públicamente** en la ficha de Play.

### [ ] 2.2 — Resolver los bloqueadores 0.1 y 0.2

`google-services.json` en su sitio y keystore generado y guardado a salvo.

### [ ] 2.3 — Compilar el bundle web y sincronizar el proyecto nativo

```bash
nvm use 20.9.0
cd supplier-management
npm run build
```

```bash
nvm use 22.22.3
npx cap sync
```

`cap sync` copia el build de Angular dentro del proyecto Android y actualiza los
plugins nativos. Ejecutarlo **siempre** después de cada `npm run build`; si no,
la app nativa sigue empaquetando el build anterior.

> `cap sync` **no** pisa `AndroidManifest.xml` ni `Info.plist` — son archivos de
> usuario. Los permisos y los textos de uso que ya están en el repo sobreviven.

### [ ] 2.4 — Subir el versionCode antes de cada envío

En `android/app/build.gradle`:

```gradle
versionCode 1      // ← incrementar SIEMPRE (1, 2, 3, ...) en cada subida
versionName "1.0"  // ← lo que ve el usuario ("1.0.1", "1.1", ...)
```

Play **rechaza** un `versionCode` repetido. Es el error más común al subir una
corrección.

### [ ] 2.5 — Generar el Android App Bundle (`.aab`) firmado

Play exige **AAB** (no APK) para apps nuevas.

Opción A — con Android Studio (recomendada la primera vez):
```bash
nvm use 22.22.3
npx cap open android
```
En Android Studio: **Build → Generate Signed App Bundle / APK → Android App
Bundle** → seleccionar `dairi.keystore`, alias `dairi`, contraseñas → variante
**release**. El archivo queda en `android/app/build/outputs/bundle/release/`.

Opción B — por línea de comandos:
```bash
cd supplier-management/android
./gradlew bundleRelease
```
(requiere que la configuración de firma esté declarada en `build.gradle` o
pasada por propiedades de Gradle).

> **En esta máquina no se puede compilar**: no hay JDK, ni Android SDK, ni
> Gradle instalados. Este paso hay que hacerlo en un equipo con Android Studio.
> Todo lo anterior (build de Angular, `cap sync`, edición de manifiestos) sí
> funciona aquí.

### [ ] 2.6 — Activar Play App Signing

Al crear la app en la consola, Play ofrece gestionar la clave de firma final.
**Aceptar.** El `dairi.keystore` pasa a ser la clave de *upload*, y si se pierde
Google puede ayudar a resetearla — sin esto, perder el keystore es terminal
(ver 0.2).

### [ ] 2.7 — Crear la ficha de Play Store

**Store presence → Main store listing:**
- Nombre (máx. 30 caracteres), descripción corta (máx. 80), descripción larga (máx. 4000).
- Gráficos del paso 1.3.
- Categoría: **Medical** (o *Business*, si se prefiere evitar el escrutinio extra
  de la categoría médica; siendo un software de gestión clínica para
  profesionales, *Medical* es lo honesto).
- Enlace a la política de privacidad (paso 1.1).

### [ ] 2.8 — Formularios de contenido (aquí está el trabajo fino)

**App content**, uno por uno:

- **Privacy policy** — la URL del paso 1.1.
- **App access** — credenciales de demo del paso 1.4.
- **Ads** — declarar si hay publicidad (no la hay).
- **Content rating** — cuestionario; sale una clasificación.
- **Target audience** — adultos/profesionales. **No** marcar público infantil.
- **Data safety** — el formulario más delicado. Usar la tabla del paso 1.2.
  Declarar sí o sí:
  - que se recoge **información de salud** y **información personal**;
  - que los datos **se comparten con terceros** (Deepgram, AWS Bedrock) para
    transcripción y generación de notas;
  - que los datos van **cifrados en tránsito**;
  - que el usuario **sí** puede pedir la eliminación de su cuenta, y que existe
    tanto en la app como en la web. **URL a pegar en el formulario:**
    `https://dairi.cl/#/eliminar-cuenta` (ver 0.3).
  - que **parte de los datos se retienen tras eliminar la cuenta**: los registros
    clínicos se conservan de forma anonimizada por obligación legal de retención.
    Play ofrece exactamente esa opción ("algunos datos no se pueden eliminar");
    **no** declarar borrado total, porque no es lo que hace la app.
  > Google contrasta esta declaración con el comportamiento real de la app. Una
  > declaración incompleta puede provocar la **retirada** de la app, no sólo un
  > rechazo.
- **Health apps declaration** — aparece si se elige categoría Medical o si se
  declaran datos de salud. Pide describir el propósito de la app y, según el
  caso, documentación que respalde que es un software legítimo de gestión
  clínica. Responder que Dairi es una herramienta de **gestión de fichas
  clínicas para profesionales de salud**, y que **no realiza diagnósticos ni
  entrega recomendaciones médicas al paciente**. Esto último es importante:
  la nota SOAP la genera un modelo de IA, pero el repo ya exige la
  **certificación del profesional** sobre esa nota (commit `4a1f14fb`) —
  mencionarlo ayuda, porque deja claro que hay un humano responsable.
- **Government apps** — no.
- **Financial features** — revisar `lambda-payment` antes de responder.

### [ ] 2.9 — Pruebas internas / cerradas antes de producción

Play ofrece los canales **Internal testing** → **Closed testing** → **Open
testing** → **Production**.

Empezar por **Internal testing**: hasta 100 testers por email, disponible en
minutos y sin revisión completa. Sirve para comprobar en un teléfono real cosas
que aquí no se pueden probar: grabación de audio, cámara, share sheet, splash.

> ## ⚠️ Requisito de 12 testers / 14 días (sólo cuentas personales)
>
> Las cuentas de desarrollador **personales** creadas después del 13 de
> noviembre de 2023 deben ejecutar una **prueba cerrada con al menos 12 testers
> que permanezcan inscritos 14 días seguidos** antes de poder solicitar acceso a
> producción.
>
> Esto puede añadir **dos semanas o más** al calendario y toma por sorpresa a
> mucha gente. Las cuentas de **organización** están exentas — otra razón para
> elegir organización en el paso 2.1 pese al trámite del D-U-N-S.

### [ ] 2.10 — Enviar a revisión

Plazos realistas:
- Apps **nuevas**: habitualmente **varios días**, y no es raro que llegue a
  **7 días o más** en cuentas nuevas o en categoría Medical.
- Actualizaciones posteriores: de unas horas a un par de días.

No planificar el lanzamiento comercial para el día siguiente al envío.

---

# FASE 3 — Apple App Store (iOS)

> ## ⚠️ Hace falta un Mac. No es opcional.
>
> Compilar, archivar y subir una app iOS **requiere macOS con Xcode**. No se
> puede hacer desde esta máquina Windows por ningún medio soportado.
>
> Opciones:
> - Un Mac (Mac mini es lo más barato).
> - Un Mac en la nube (MacStadium, MacinCloud).
> - CI con runners macOS (GitHub Actions, Codemagic, Bitrise) — permite compilar
>   y subir sin Mac físico, pero configurar firma y certificados en CI es más
>   difícil la primera vez que hacerlo en un Mac.
>
> Todo lo demás (build Angular, `cap sync`, editar `Info.plist`) se puede
> preparar aquí y llevar al Mac por git.

### [ ] 3.1 — Apple Developer Program

1. <https://developer.apple.com/programs/> → inscribirse.
2. **US$99 al año** (recurrente, a diferencia de Play).
3. Persona natural o empresa. Como empresa pide **D-U-N-S** (igual que Play) y
   demora más, pero hace que la app aparezca a nombre de la empresa.
4. Verificación de identidad: puede tardar de días a un par de semanas.

### [ ] 3.2 — Registrar el App ID y crear la app en App Store Connect

1. En <https://appstoreconnect.apple.com> → **My Apps → +**.
2. **Bundle ID**: `cl.dairi.app` (debe coincidir con `PRODUCT_BUNDLE_IDENTIFIER`).
3. Nombre, idioma principal (Español), SKU interno.

### [ ] 3.3 — Preparar y sincronizar el proyecto

En el Mac, tras clonar el repo:
```bash
nvm use 20.9.0 && cd supplier-management && npm install && npm run build
nvm use 22.22.3 && npx cap add ios       # el proyecto iOS no viene en el repo
npx cap sync ios

# ⚠️ IMPRESCINDIBLE (paso 0.7): sin esto la app se CIERRA al usar el micrófono
cp native-config/ios/Info.plist ios/App/App/Info.plist

cd ios/App && pod install     # CocoaPods, sólo en macOS
npx cap open ios
```

### [ ] 3.4 — Verificar los textos de permisos en `Info.plist`

Ya están en el repo (`ios/App/App/Info.plist`) y son obligatorios: sin ellos iOS
**cierra la app** al tocar el micrófono o la cámara, y App Review rechaza.

Presentes actualmente:
- `NSMicrophoneUsageDescription` — grabación de la atención clínica.
- `NSCameraUsageDescription` — fotografiar documentos clínicos.
- `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription`.

Si se cambia el texto, mantenerlo **específico**: decir qué se hace con el dato y
por qué. Textos vagos ("la app necesita el micrófono") son motivo de rechazo.

### [ ] 3.5 — Firma en Xcode

En Xcode, target **App → Signing & Capabilities**:
- Marcar **Automatically manage signing**.
- Elegir el **Team** de la cuenta de desarrollador.
- Xcode genera certificados y perfiles solo.
- Si se usan push, añadir la capability **Push Notifications** (y ver 0.4: hoy
  no hay emisor, así que quizá convenga **no** añadirla todavía).

### [ ] 3.6 — Subir la versión y archivar

- Subir `CURRENT_PROJECT_VERSION` (build) en cada subida; `MARKETING_VERSION` es
  la versión visible.
- En Xcode: seleccionar destino **Any iOS Device (arm64)** →
  **Product → Archive**.
- Al terminar se abre el Organizer → **Distribute App → App Store Connect →
  Upload**.

### [ ] 3.7 — TestFlight

La build aparece en **TestFlight** tras unos minutos de procesamiento.
- **Internal testing**: hasta 100 miembros del equipo, sin revisión.
- **External testing**: hasta 10.000 testers, requiere una revisión ligera
  (normalmente ~1 día).

Probar en un iPhone real, sobre todo: micrófono, cámara, el *share sheet* de
recetas/presupuestos y el guardado del certificado Zero-Knowledge.

### [ ] 3.8 — Ficha de App Store y App Privacy

**App Information / Pricing / App Privacy:**

- Categoría: **Medical** o **Business** (mismo criterio que en 2.7).
- Capturas y descripción (paso 1.3).
- **App Privacy** — la "nutrition label". Se declara por tipo de dato:
  *Health & Fitness*, *Contact Info*, *Identifiers*, *User Content*, y para cada
  uno si está **vinculado a la identidad del usuario** y si se usa para
  seguimiento. Usar la tabla del paso 1.2 y **mantener la coherencia con lo
  declarado en Play**.
- **Account deletion**: Apple pregunta explícitamente por el borrado de cuenta.
  Responder que **sí**, y que está dentro de la app en **Mi cuenta → Eliminar mi
  cuenta** (icono ⚙ en el pie de la barra lateral). Ver paso 0.3 — ya implementado.

### [ ] 3.9 — Escrutinio adicional por datos de salud

Apple mira con lupa cualquier app que toque datos médicos, aunque no use
HealthKit (Dairi **no** lo usa; no hace falta declararlo, y no conviene añadirlo
sin necesidad, porque abre otro bloque de requisitos).

Guidelines relevantes:
- **1.4.1 — Physical Harm**: si una app da información médica inexacta puede ser
  rechazada. Dairi genera notas SOAP con IA: presentarla como **herramienta de
  documentación para profesionales**, nunca como algo que diagnostica. Ayuda
  mucho que el flujo ya exija que el profesional **certifique** la nota generada
  (commit `4a1f14fb`).
- **5.1.1 — Data Collection and Storage**: consentimiento y minimización.
- **5.1.3 — Health and Research**: los datos de salud **no** pueden usarse para
  publicidad ni venderse a data brokers; tampoco pueden guardarse en iCloud.
- **2.1 — App Completeness**: la app debe estar terminada. Botones que no hacen
  nada son rechazo — otra razón para no exponer push (0.4) ni la conexión a
  Google Calendar en nativo (0.5).

En las **notas para el revisor**, explicar en dos o tres frases qué es Dairi,
quién la usa (profesionales de salud, no pacientes) y que los datos de las
capturas son ficticios.

### [ ] 3.10 — Enviar a revisión

Plazos realistas:
- La mayoría de las revisiones se resuelven en **24–48 horas**.
- Una app **nueva** en categoría médica puede tardar más, y es **muy probable**
  al menos una ronda de rechazo con preguntas.
- Presupuestar **1–2 semanas** desde el primer envío hasta la aprobación.

---

# FASE 4 — Justificación de permisos (para las dos tiendas)

Ambas tiendas piden justificar cada permiso. Estado real del repo tras la
revisión del 2026-08-05:

| Permiso | Plataforma | ¿Declarado? | Justificación honesta |
|---|---|---|---|
| `INTERNET` | Android | Sí | La app es un cliente de una API en AWS. |
| `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` | Android | Sí | Grabar la atención clínica para transcribirla y generar la nota SOAP. Sólo se activa cuando el profesional pulsa grabar. |
| `NSMicrophoneUsageDescription` | iOS | Sí | Igual que el anterior. |
| `POST_NOTIFICATIONS` | Android | Sí | Recordatorios de citas. **Ver 0.4: el circuito no está terminado.** Si no se completa, quitarlo. |
| Cámara | Ambas | **Android: NO. iOS: sí (texto de uso)** | Fotografiar documentos clínicos. Ver nota abajo. |
| Calendario | Ninguna | **No se pide** | La integración con Google Calendar es por OAuth web / URL pública, **no** por el calendario del sistema. No hay permiso nativo que justificar. |

> **Por qué Android no declara `CAMERA` (es intencional, no un olvido):**
> la captura de fotos usa `<input type="file" accept="image/*" capture="environment">`,
> que Capacitor resuelve en `BridgeWebChromeClient.onShowFileChooser`. Ese código
> llama a `isMediaCaptureSupported()`, que devuelve `true` cuando `CAMERA` está
> concedido **o cuando no está declarado en el manifiesto**. Dejarlo sin declarar
> hace que la cámara se abra directamente, sin prompt. Declararlo obligaría a un
> permiso en tiempo de ejecución adicional, uno más que justificar en Play, y no
> habilitaría nada nuevo: la app nunca llama a `getUserMedia({video:true})`.
> **No añadir `CAMERA` "por si acaso".**

---

# FASE 5 — Rechazos más probables en el caso concreto de Dairi

Ordenados por probabilidad:

1. ~~**Sin eliminación de cuenta**~~ — **resuelto** (0.3). Lo que queda de este
   riesgo es *declararlo mal*: si en Data Safety / App Privacy no se menciona que
   se retienen registros clínicos anonimizados, la contradicción con el
   comportamiento real es motivo de retirada.
2. **Revisor sin poder entrar** — faltan credenciales de demo o están caducadas (1.4).
3. **Metadata inexacta** — prometer push (0.4) o sincronización de calendario en
   móvil (0.5) que la app no hace.
4. **Data Safety / App Privacy incompletos** — no declarar Deepgram y Bedrock
   como terceros que reciben datos de salud (1.2).
5. **Política de privacidad ausente o genérica** — no menciona datos de salud ni
   subprocesadores (1.1).
6. **Capturas de iPad faltantes** — porque el proyecto declara soporte iPad (1.3).
7. **Textos de permiso vagos** en `Info.plist` (3.4).
8. **App incompleta** — botones sin efecto en el dispositivo real.

---

# FASE 6 — Después de publicar

- **Actualizaciones**: subir `versionCode`/`CURRENT_PROJECT_VERSION`,
  `npm run build`, `npx cap sync`, recompilar, subir. Mismo circuito.
- **El contenido web va dentro del binario.** `capacitor.config.ts` no define
  `server.url`, así que la app sirve los archivos empaquetados: **un deploy a S3
  NO actualiza la app móvil**. Todo cambio de frontend requiere una nueva
  versión en las tiendas.
- **targetSdk**: Google sube el mínimo exigido cada año (~agosto). Hoy el repo
  está en 36, que está al día, pero habrá que subirlo periódicamente o Play
  dejará de aceptar actualizaciones.
- **Renovar** el Apple Developer Program cada año o la app se retira de la tienda.
- Vigilar reseñas y *crash reports* (Play Console / Xcode Organizer).

---

# Apéndice — Trabajo pendiente conocido (estado 2026-08-05)

Cosas que **no** están resueltas y que conviene tener presentes al planificar:

1. **Entrega del token de push** — `mobile.service.ts`,
   `PUSH_TOKEN_DELIVERY_ENABLED = false`. Falta: almacenamiento
   `{userId, token, platform}`, un `POST /api/devices/token` autenticado con su
   `DELETE` en el logout, y un emisor real (Firebase Admin o SNS).
2. **OAuth de Google Calendar en nativo** — `google-calendar.service.ts`.
   Para que funcione hace falta rehacerlo como *authorization code + PKCE*
   abierto con `@capacitor/browser` en una Custom Tab / SFSafariViewController,
   con redirect a un esquema propio capturado por el listener `appUrlOpen` de
   `@capacitor/app` (ambos paquetes ya están instalados), **más** client IDs
   nuevos de tipo Android e iOS en Google Cloud Console. No implementado; en
   nativo la funcionalidad está deshabilitada de forma explícita y controlada.
3. ~~**Eliminación de cuenta**~~ — **hecho** (0.3): `DELETE /api/auth/account`,
   `/#/app/cuenta` (en la app) y `/#/eliminar-cuenta` (público). Lo que sigue
   pendiente es reflejarlo en la política de privacidad y en las fichas de
   Data Safety / App Privacy.
4. **Lambda `db-access`** — sigue desplegada y sin JWT (0.6).
5. **Extensión de los audios** — los archivos se suben como `.webm` incluso en
   iOS, donde el contenido real es MP4/AAC. **Es intencional**: la notificación
   de S3 que dispara la transcripción filtra por sufijo `.webm`
   (`transcribe-nova-3-audio-trigger` en el bucket `budget-riquelmetapia`), y
   Deepgram detecta el contenedor por los bytes, no por el nombre. Cambiar la
   extensión sin cambiar antes el filtro de S3 **dejaría a iOS sin
   transcripción, en silencio**. Ver el comentario en
   `src/app/services/audio-recorder.service.ts` (`_extFor`).
6. **Periodontograma en móvil** — requiere desplazamiento horizontal real en un
   teléfono (ancho mínimo 920px). Detectado en la sesión anterior, no rediseñado.
