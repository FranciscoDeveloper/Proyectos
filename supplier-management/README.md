# Dairi — Plataforma de Gestión Clínica

Software SaaS para clínicas y consultorios médicos en Chile y Latinoamérica. Centraliza pacientes, agenda, fichas clínicas, pagos y analítica en una sola plataforma con IA, desplegada íntegramente en AWS.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  Angular SPA (S3 + CloudFront)   https://dairi.cl              │
│  ├── /login  /register  /activate                               │
│  ├── /app/*  (módulos protegidos por JWT)                       │
│  └── /#/book (reserva pública, sin login)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS / API Gateway
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  Lambda: login    Lambda: dairi-bff   Lambda: dairi-soap-processor
  (auth, fuera     (BFF en VPC,        (S3 trigger: recordings/*.md
   de VPC)          acceso RDS)         → escribe SOAP en RDS)
                         │
                    RDS PostgreSQL (VPC privada)
```

### Lambdas

| Directorio | Función AWS | Descripción |
|---|---|---|
| `lambda-auth` | `login` | Autenticación: login, registro, activación, refresh, logout |
| `lambda-dairi-bff` | `dairi-bff` | Backend-for-frontend: todas las rutas `/api/*` protegidas |
| `lambda-soap-processor` | `dairi-soap-processor` | Trigger S3 → genera SOAP con Amazon Bedrock |
| `lambda-helpdesk-worker` | `dairi-helpdesk-worker` | Worker SQS → DynamoDB (helpdesk) |

---

## Tecnologías

### Frontend
- **Angular 19** — standalone components, signals, `CommonModule`
- **Capacitor 8** — app nativa Android/iOS desde el mismo código
- **Angular Material + SCSS custom** — temas light/dark
- **Node 20.9.0** para build; **Node 22.22.3** para build mobile (Capacitor)

### Backend (Lambda dairi-bff)
- **Node.js 20 ES modules** (`.mjs`, `"type":"module"`)
- **pg (node-postgres)** — Pool de conexiones, `withClient(fn)` helper
- **jsonwebtoken** — Verificación JWT con `JWT_SECRET`
- **Amazon Bedrock** (`anthropic.claude-3-haiku-20240307-v1:0`) — Notas SOAP + resumen clínico narrativo
- **Deepgram Nova-3** — Transcripción de voz en español médico
- **Amazon SES** — Envío de presupuestos y correos de activación
- **DynamoDB** — Chat del equipo y helpdesk
- **Amazon S3** — Documentos de pacientes (`patient-docs/{id}/`)

### Base de Datos
- **PostgreSQL 14** — RDS `db.t3.micro` en VPC privada
- Esquema principal: `app_user`, `patient`, `professional`, `clinical_record`, `appointment`, `payment`, `presupuesto`, `product`, `supplier`, `expense`, `app_schema`, `user_schema`

---

## Módulos de la Aplicación

### Pacientes
CRUD completo con perfil, historial, previsión (FONASA/ISAPRE/Particular), contacto de emergencia y documentos adjuntos.

### Fichas Clínicas Especializadas
9 plantillas por especialidad: medicina general, psicología, odontología, kinesiología, nutrición, fonoaudiología, terapia ocupacional, matrona y tecnología médica. Cada ficha incluye signos vitales, alertas, SOAP generado por IA y registro de encuentros anteriores.

### Agenda / Citas
Vista mensual con estados configurables (Agendada, Confirmada, Completada, Cancelada, No asistió), asignación por profesional y modalidades: presencial, videoconsulta y teléfono.

### Reserva Online Pública (`/#/book`)
Flujo de reserva sin login: selección de especialidad → médico → horario → datos del paciente → pago. Integrado con **Flow** y **Transbank Webpay** para pago con Redcompra y tarjeta de crédito.

### Reportes y Analítica
KPIs de citas, pacientes, ingresos y fichas clínicas con filtros 7 días / 30 días / histórico. Gráficos de barras y desglose por profesional, diagnóstico y previsión.

### Comisiones
Cálculo automático de comisiones por profesional según tasa configurada. Filtro por período y estado de liquidación.

### Pagos y Presupuestos
Registro de cobros con método de pago (efectivo, tarjeta, transferencia). Generación de presupuestos PDF con envío automático por email vía Amazon SES.

### Transcripción de Voz con IA
Grabación de audio en el navegador → Deepgram Nova-3 transcribe → Amazon Bedrock genera nota SOAP → se pre-carga en la ficha clínica activa.

### Resumen Clínico (`GET /api/clinical-summary/{id}`)
Amazon Bedrock genera un resumen narrativo del historial completo del paciente: diagnósticos, medicamentos, evolución clínica y próximas acciones recomendadas.

### Chat Interno + Asistente IA
Chat de equipo (mensajes directos) vía DynamoDB. El asistente Dairi IA responde consultas operativas en todos los planes.

### Control de Acceso por Rol
- **admin / superadmin**: acceso total a todos los módulos
- **profesional**: ve solo sus propios pacientes, citas, cobros y fichas (filtrado server-side via `profScope`)
- Autorización por módulo: tabla `app_schema` + `user_schema` — si no existe la fila, devuelve 403

---

## Integraciones

| Integración | Uso |
|---|---|
| **Amazon Web Services** | Infraestructura completa: Lambda, S3, DynamoDB, RDS, SES, Bedrock |
| **Amazon Bedrock** (Claude 3 Haiku) | Notas SOAP clínicas + resumen narrativo del historial |
| **Deepgram Nova-3** | Transcripción de audio médico en español con diarización |
| **Flow.cl** | Pasarela de pagos online chilena — cobros en reservas |
| **Transbank Webpay** | Pago con Redcompra y tarjeta de crédito en reservas |
| **Google Calendar & Meet** | Sincronización de citas y generación de enlace de videoconsulta |
| **Amazon SES** | Envío de presupuestos y correos de activación de cuenta |

---

## Estructura del Repositorio

```
supplier-management/
├── src/app/
│   ├── components/
│   │   ├── landing/          # Página pública dairi.cl
│   │   ├── patient-booking/  # Reserva online /#/book
│   │   ├── reports/          # Reportes y KPIs
│   │   ├── commissions/      # Comisiones por profesional
│   │   ├── clinical-records/ # Ficha clínica + IA
│   │   ├── appointments/     # Agenda
│   │   ├── patients/         # Gestión de pacientes
│   │   └── ...
│   └── services/             # Servicios Angular (HTTP, auth, etc.)
├── lambda-dairi-bff/
│   ├── index.mjs             # Router principal (thin, 129 líneas)
│   ├── handlers/             # Un handler por dominio
│   │   ├── bookingProxyHandler.mjs
│   │   ├── chatHandler.mjs
│   │   ├── clinicalHandler.mjs
│   │   ├── documentsHandler.mjs
│   │   ├── entitiesHandler.mjs
│   │   ├── adminHandler.mjs
│   │   └── userConfigHandler.mjs
│   ├── services/
│   │   ├── crudService.mjs
│   │   ├── emailService.mjs
│   │   └── profScopeService.mjs
│   ├── lib/
│   │   ├── auth.mjs          # verifyToken, authorizeRequest
│   │   ├── db.mjs            # Pool, withClient, ensureLookupTables
│   │   ├── logger.mjs        # Logger con traceId por invocación
│   │   ├── rateLimit.mjs     # Rate limiter en memoria
│   │   └── response.mjs      # Helpers HTTP + headers CORS
│   └── config/
│       └── entities.mjs      # ENTITY_CONFIG + KEY_ALIASES (17+ entidades)
├── lambda-auth/              # Login, register, activate, refresh
└── lambda-soap-processor/    # SOAP trigger S3
```

---

## Deployment

### Frontend (Angular → S3)

```bash
nvm use 20.9.0
cd supplier-management
npm run build
# Sync al bucket — SIEMPRE con --exclude patient-docs/*
python -m awscli s3 sync dist/supplier-management/browser s3://friquelme-firstpage \
  --delete --exclude "patient-docs/*" --region us-east-1
```

### Lambda (Node.js → ZIP → AWS)

```bash
cd supplier-management/lambda-dairi-bff
zip -r lambda-dairi-bff.zip index.mjs package.json node_modules handlers lib services config
python -m awscli lambda update-function-code \
  --function-name dairi-bff --region us-east-1 \
  --zip-file fileb://lambda-dairi-bff.zip
```

---

## Variables de Entorno (Lambda dairi-bff)

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Clave de firma JWT (obligatoria — la Lambda no arranca sin ella) |
| `DB_HOST` | Host RDS PostgreSQL |
| `DB_PORT` | Puerto (default `5432`) |
| `DB_NAME` | Nombre de la base de datos |
| `DB_USER` | Usuario PostgreSQL |
| `DB_PASSWORD` | Contraseña PostgreSQL |
| `BOOK_FUNCTION_URL` | URL de la Lambda de reservas (proxy) |
| `SES_FROM` | Email remitente para SES |

---

## Desarrollo Local

```bash
# Frontend
nvm use 20.9.0
cd supplier-management
npm install
npm start          # http://localhost:4200

# Compilación para mobile (requiere Node 22)
nvm use 22.22.3
npx cap sync android
npx cap open android
nvm use 20.9.0     # volver a Node 20
```

### Base de Datos Local

```
Host: localhost | Puerto: 5432 | DB: dairi | Usuario: postgres | Password: admin
```

---

## Reglas y Restricciones

- **No exponer la RDS a internet** — solo acceso desde VPC
- **No crear recursos de red** (SGs, subnets, VPCs, Elastic IPs)
- **Apagar RDS** al terminar de trabajar: `aws rds stop-db-instance --db-instance-identifier database-dairi`
- **S3 sync siempre con** `--exclude "patient-docs/*"` cuando se usa `--delete`
- **Node 20.9.0** para todo lo que no sea Capacitor/mobile
