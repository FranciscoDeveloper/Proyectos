# Dairi — Instrucciones para Claude Code

## Arquitectura general

Aplicación clínica SaaS compuesta por:
- **Frontend**: Angular SPA desplegada en S3 (`supplier-management/src/`)
- **Lambda-auth** (`login`): Auth fuera de VPC — login, register, activate, refresh, logout
- **Lambda-dairi-bff** (`dairi-bff`): Backend-for-frontend en VPC, acceso directo a RDS PostgreSQL
- **Lambda-dairi-bff** también maneja entidades vía `/api/entities/{entity}` con autorización por `app_schema`
- **Lambda-soap-processor**: Trigger S3 en `recordings/*.md` → escribe SOAP en `clinical_record`
- **Lambda-helpdesk-worker**: SQS → DynamoDB
- **Lambda-entities**, **lambda-book**, **lambda-payment**, **lambda-audio**, **lambda-transcribe**: funciones auxiliares
- **db-access Lambda**: auxiliar de diagnóstico — **NO es un endpoint real, NO tiene JWT, será eliminada cuando se venda el software**

## Node.js — versiones requeridas

| Contexto | Versión |
|---|---|
| Build Angular, deploy S3, Lambdas | **Node 20.9.0** (`nvm use 20.9.0`) |
| Capacitor / mobile builds | **Node 22.22.3** (`nvm use 22.22.3`) |

Siempre volver a Node 20 después de trabajo mobile.

## Bases de datos

### Local (desarrollo)
- **Motor**: PostgreSQL 14 — `C:\Program Files\PostgreSQL\14\bin\psql.exe`
- **Host**: localhost | **Puerto**: 5432 | **DB**: dairi | **Usuario**: postgres | **Password**: admin
- Variable de entorno para scripts: `$env:PGPASSWORD = "admin"`

### RDS (producción)
- **Host**: `database-dairi.c2dmaac0mg07.us-east-1.rds.amazonaws.com`
- **Puerto**: 5432 | **DB**: postgres | **Usuario**: postgres | **Password**: admin12345
- **Instancia**: `db.t3.micro`, 20 GB gp2 — **apagar cuando no se use** (`aws rds stop-db-instance --db-instance-identifier database-dairi`)
- **Acceso**: solo desde VPC (`vpc-0e99bc3b783e6f17c`). Nunca hacer pública la RDS.
- **Costo estimado parada**: ~$2.30/mes (solo almacenamiento)

### VPC y security groups
- VPC: `vpc-0e99bc3b783e6f17c`
- SGs existentes (no crear nuevos): `sg-030bb0f1877ec8150` (default), `sg-0058ddca31046cb3b` (rds-lambda-3)

## JWT

- **Secret**: `dairi-secret-key-2026`
- **Payload**: `{ sub, email, role }`
- **Expiración access token**: 2h | **Refresh token**: 7 días
- Sub `4` = usuario admin de prueba

## AWS CLI

Usar siempre: `python -m awscli` (awscli v1 instalado via pip, no `aws` directo)

## Deployment de Lambdas

Patrón estándar para todas las funciones en `supplier-management/`:

```powershell
cd "d:\github\Proyectos\supplier-management\lambda-<nombre>"
Compress-Archive -Path "index.mjs","package.json","node_modules" -DestinationPath "lambda-<nombre>.zip" -Force
python -m awscli lambda update-function-code --function-name <nombre-funcion> --region us-east-1 --zip-file "fileb://lambda-<nombre>.zip" --query "LastUpdateStatus" --output text
```

Verificar estado: `python -m awscli lambda get-function-configuration --function-name <nombre> --region us-east-1 --query "LastUpdateStatus" --output text`

### Nombres de funciones Lambda en AWS

| Directorio | Nombre en AWS |
|---|---|
| `lambda-auth` | `login` |
| `lambda-dairi-bff` | `dairi-bff` |
| `lambda-soap-processor` | `dairi-soap-processor` |
| `lambda-helpdesk-worker` | `dairi-helpdesk-worker` |

## Frontend — deploy S3

```bash
# Requiere Node 20.9.0
nvm use 20.9.0
cd supplier-management
npm run build
```

```powershell
# Sync al bucket — excluir patient-docs/ (archivos de pacientes, no forman parte del build)
python -m awscli s3 sync "dist/supplier-management/browser" "s3://friquelme-firstpage" --delete --exclude "patient-docs/*" --region us-east-1
```

> **IMPORTANTE**: Siempre usar `--exclude "patient-docs/*"` en el sync. Sin eso, el `--delete` borra los documentos de pacientes del bucket.

## Bucket S3 — friquelme-firstpage

- Bucket de hosting web: `friquelme-firstpage` (us-east-1)
- `patient-docs/{id}/` — documentos de pacientes, acceso restringido (solo pre-signed URLs)
- Política de bucket: acceso público al sitio, Deny directo a `patient-docs/*`, Allow al rol BFF Lambda
- CORS configurado para permitir PUT desde el browser (subida de documentos)
- Rol BFF que tiene acceso S3: `dairi-medical-agent-role-x9s7v66c` (concedido vía bucket policy, no IAM)
- **No usar `--delete` sin `--exclude "patient-docs/*"`** en el sync

## Esquema de autorización (BFF)

- `authorizeRequest()` en BFF consulta `user_schema JOIN app_schema WHERE schema_key = $entityKey`
- Si no existe la fila en `app_schema` → **403**
- Entidades con `skipAuth: true` (sin restricción): `patients`, `previsiones`, `medicos`
- `KEY_ALIASES` en BFF: `clinicalRecords→'clinical-records'`, `psych-sessions→'appointments'`, `dental-sessions→'appointments'`, etc.

## Registro de usuarios — tablas afectadas

Al registrar (`POST /register`):
1. `app_user` — INSERT (email_verified=false, role='admin')
2. `app_user` — UPDATE SET activation_token (JWT 24h)
3. `user_schema` — INSERT módulos por defecto: `clinicalRecords`, `appointments`, `reports`, `presupuestos`

Al activar (`POST /activate`):
4. `app_user` — UPDATE SET email_verified=true, activation_token=NULL

`refresh_token` solo se toca en login, no en registro.

## Reglas y restricciones críticas

- **No hacer la RDS pública** — aumenta la factura AWS
- **No crear recursos de red** (SGs, subnets, VPCs, Elastic IPs, etc.)
- **No aumentar costos AWS** para investigación — usar mecanismos existentes
- **db-access Lambda es auxiliar**: no agregar JWT, no tratar como endpoint de producción, restaurar a original después de cada uso diagnóstico
- **Apagar RDS** al terminar de trabajar con ella
- **No usar `--no-verify`** ni saltarse hooks de git
