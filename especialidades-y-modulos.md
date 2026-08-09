# Módulos por especialidad

Qué módulos (`schemas`) debe tener cada especialidad en su cuenta Pro, y por qué. Esto determina lo que aparece en el sidebar de cada profesional — no es una restricción de seguridad (ver nota al final).

## Contexto

- Los módulos de una cuenta Pro viven en el array `schemas` de su ítem en DynamoDB (`dairi-accounts`) — ver `handleLoginDairi` en `supplier-management/lambda-auth/index.mjs`. Ese array es lo único que decide qué aparece en el sidebar.
- Cada módulo de "ficha clínica" (`moduleType: 'clinical-record'`) tiene una clave de especialidad (ej. `dental-records`) que en el backend está aliada a la misma tabla `clinical_record` — ver `KEY_ALIASES` en `supplier-management/lambda-dairi-bff/config/entities.mjs`. Son formularios distintos sobre la misma fila, no datos separados.
- Definiciones completas de campos en `supplier-management/src/app/services/auth.service.ts`, **registradas** en `ENTITY_CATALOG` de `supplier-management/src/app/services/schema.service.ts`. El login devuelve los módulos con `fields: []`, así que un `const SCHEMA_*` que nadie registre en el catálogo no hace nada (ver más abajo).

## Tabla de referencia

| Especialidad (`professional_specialty.value`) | Ficha clínica | Agenda | Universales |
|---|---|---|---|
| `medicina-general` | `clinicalRecords` (alias de `clinical-records`) | `appointments` | `reports`, `presupuestos` |
| `psicologia` | `psych-records` | `psych-sessions` | `reports`, `presupuestos` |
| `odontologia` | `dental-records` | `dental-sessions` | `reports`, `presupuestos` |
| `kinesiologia` | `kine-records` | `kine-sessions` | `reports`, `presupuestos` |
| `nutricion` | `nutrition-records` | `nutrition-sessions` | `reports`, `presupuestos` |
| `fonoaudiologia` | `fono-records` | `fono-sessions` | `reports`, `presupuestos` |
| `terapia-ocupacional` | `ot-records` | `ot-sessions` | `reports`, `presupuestos` |
| `matrona` | `matrona-records` | `matrona-sessions` | `reports`, `presupuestos` |
| `tecnologia-medica` | `tecnomed-records` | `tecnomed-sessions` | `reports`, `presupuestos` |

`reports` y `presupuestos` no tienen variante por especialidad — van siempre, para las 9.

## Regla general

**Cada cuenta debe tener exactamente UNA ficha clínica (la de su especialidad) y UNA agenda — nunca la genérica (`clinicalRecords`/`appointments`) junto con la específica de su especialidad.** Son alias de la misma tabla; tenerlas ambas no da funcionalidad extra, solo duplica el menú con dos entradas que muestran a los mismos pacientes.

Ejemplo real: a Constanza Jimenez (odontología) se le dio por defecto `clinicalRecords` al registrarse (es el default de toda cuenta Pro nueva, `DEFAULT_DAIRI_SCHEMAS` en `lambda-auth/index.mjs`) y después se le agregó `dental-records` a mano. Se le quitó `clinicalRecords` el 2026-08-08 — se queda solo con `dental-records`, que además incluye odontograma y periodontograma que `clinicalRecords` no tiene.

Se le quitó también el `appointments` genérico el 2026-08-09 — se queda solo con `dental-sessions` + `dental-records`, `reports`, `presupuestos`. Verificado en DynamoDB.

## ✅ Resuelto (2026-08-09): las 9 especialidades ya tienen agenda propia

Antes, sólo psicología y odontología tenían agenda propia (`psych-sessions`, `dental-sessions`). Las otras 6 caían en la genérica `appointments`, cuyo `encounterEntity` es `clinical-records`: el atajo **"Agregar Antecedente"** desde el detalle de una cita abría la ficha de *medicina general*, no la de la especialidad.

Ahora existen las 6 agendas que faltaban — `kine-sessions`, `nutrition-sessions`, `fono-sessions`, `ot-sessions`, `matrona-sessions`, `tecnomed-sessions` — cada una con su `encounterEntity` apuntando a la ficha de su especialidad. Verificado end-to-end en producción con una cuenta de prueba de kinesiología: el atajo lleva a `/app/clinical/kine-records/{id}/encounter` y abre "Nueva Atención — Ficha Kinésica".

### Dónde vive cada pieza

| Pieza | Archivo | Qué hace |
|---|---|---|
| Definición de la agenda (campos + `encounterEntity`) | `supplier-management/src/app/services/auth.service.ts` (`SCHEMA_*_SESSIONS`, fábrica `specialtyCalendarSchema`) | Etiquetas y campos del calendario |
| Registro en el catálogo que la app recorre | `supplier-management/src/app/services/schema.service.ts` (`ENTITY_CATALOG`) | **Sin esta entrada la agenda no existe para el frontend** |
| Campos cifrados (ZK) | `supplier-management/src/app/services/crypto.service.ts` (`ENCRYPTED_FIELDS`) | Mismos campos que `appointments` |
| Alias a la tabla `appointment` | `supplier-management/lambda-dairi-bff/config/entities.mjs` (`KEY_ALIASES`) | El BFF resuelve la clave a `appointments` |

**Ojo con el catálogo:** el `schemas` que devuelve el login viene de DynamoDB con `fields: []`, así que los campos siempre salen de `ENTITY_CATALOG`. Los `const SCHEMA_*` de `auth.service.ts` sólo tienen efecto si `schema.service.ts` los importa y los registra.

## ✅ Resuelto (2026-08-09, segunda pasada): atajo "Agregar Antecedente" en psicología y odontología

`SCHEMA_PSYCH_SESSIONS` y `SCHEMA_DENTAL_SESSIONS` existían con campos reales (y `dental-sessions` ya tenía `encounterEntity: 'dental-records'` correctamente definido) pero **no estaban exportadas**, y `schema.service.ts` las duplicaba inline con `fields: []` en vez de importarlas — el trabajo ya hecho nunca llegaba a producción. Se exportaron ambas, se agregó `encounterEntity: 'psych-records'` a `psych-sessions` (nunca lo había tenido) y se registraron en `ENTITY_CATALOG` igual que las 6 nuevas. Verificado en el bundle desplegado (`encounterEntity` presente en los chunks de producción).

`SCHEMA_APPOINTMENTS` sigue siendo una const huérfana (nada la importa) — no es un problema porque `appointments` nunca tuvo la duplicación inline que sí tenían psych/dental; su entrada en `ENTITY_CATALOG` usa campos propios equivalentes. No se tocó.

## Pendiente: asignación automática por especialidad

Crear las agendas es una cosa; **entregárselas a una cuenta nueva es otra**. Hoy toda cuenta Pro nace con `DEFAULT_DAIRI_SCHEMAS` (`clinicalRecords`, `appointments`, `reports`, `presupuestos`) y los módulos de especialidad se agregan a mano al array `schemas` de DynamoDB. Que un registro con especialidad reciba automáticamente su par ficha+agenda es una decisión de producto separada, sin implementar.

## Nota sobre autorización

Esta tabla describe únicamente qué aparece en el sidebar. No es una restricción de acceso: en `supplier-management/lambda-dairi-bff/lib/auth.mjs`, las cuentas con `role: 'admin'` (que es como se registra toda cuenta Pro) tienen bypass total de la autorización por módulo — pueden alcanzar cualquier entidad si conocen la URL, tengan o no esa clave en su `schemas`. La tabla de arriba es sobre UX de navegación, no sobre seguridad.
