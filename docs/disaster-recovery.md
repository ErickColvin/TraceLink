# Disaster recovery

## Estado

La política y el procedimiento están definidos, pero no hay una instancia Railway ni acceso a backups en este workspace. Backup gestionado y restore drill real: **PENDIENTE — MANUAL OWNER ACTION REQUIRED**.

No se declara un RPO/RTO garantizado hasta medir un restore aislado.

## Política mínima requerida

| Copia | Frecuencia objetivo | Retención objetivo | Estado |
| --- | --- | --- | --- |
| Railway backup | diaria | 14 días o límite del plan | pendiente de habilitar |
| Railway backup | semanal | 8 semanas o límite del plan | pendiente de habilitar |
| `pg_dump` cifrado offsite | semanal | 8 semanas | pendiente de definir destino |

El owner debe confirmar las capacidades y límites del plan Railway contratado. El storage offsite debe pertenecer a otra frontera de fallo, cifrar en tránsito/reposo, restringir lectura y probar descarga.

## Backup offsite

Requisitos: cliente PostgreSQL compatible, espacio suficiente, `DATABASE_URL` obtenida del secret manager y destino cifrado aprobado.

```powershell
pg_dump --format=custom --no-owner --no-acl --file tracelink-backup.dump "$env:DATABASE_URL"
Get-FileHash -Algorithm SHA256 tracelink-backup.dump
```

No imprimir la URL ni subir el dump al repositorio. Registrar fecha, entorno, tamaño, hash, responsable y ubicación segura. Eliminar la copia local únicamente después de confirmar el upload y según la política aprobada.

## Restore drill obligatorio

Nunca usar production como target del ensayo.

1. Crear una base PostgreSQL vacía y aislada, sin tráfico de aplicación.
2. Verificar visualmente que `RESTORE_DATABASE_URL` identifica la base aislada.
3. Restaurar:

```powershell
pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl --dbname "$env:RESTORE_DATABASE_URL" tracelink-backup.dump
```

4. Apuntar `DATABASE_URL` temporalmente a la base restaurada en una terminal aislada.
5. Ejecutar:

```powershell
corepack pnpm db:verify
corepack pnpm db:migration:check
```

6. Verificar al menos:

```sql
SELECT COUNT(*) FROM organizations;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM inventory_movements;
SELECT COUNT(*) FROM payments;
SELECT COUNT(*) FROM audit_logs;
SELECT COUNT(*) FROM outbox_events;
```

7. Arrancar una API aislada, comprobar `/health` y `/health/ready`, login staff, lectura de un pedido y consistencia de inventario.
8. Destruir la base de ensayo solo después de registrar resultados, usando el panel y verificando el nombre exacto.

## Registro de medición

| Campo | Resultado actual |
| --- | --- |
| fecha | pendiente |
| backup probado | pendiente |
| base aislada | pendiente |
| inicio/fin | pendiente |
| RPO observado | no medido |
| RTO observado | no medido |
| integridad | no ejecutada |
| responsable | pendiente |

RPO observado es la antigüedad de los datos restaurados respecto del incidente simulado. RTO observado se mide desde el inicio de recuperación hasta tener API aislada lista y controles de integridad aprobados.

## Recuperación real

1. Declarar incidente y congelar escrituras si hacerlo reduce daño.
2. Preservar logs y evidencia.
3. Elegir backup por RPO y verificar hash/fecha.
4. Restaurar primero en base aislada.
5. Ejecutar controles de integridad y revisión de seguridad.
6. Decidir con owner técnico si promover la base restaurada o aplicar reparación.
7. Cambiar conexiones mediante secret manager, nunca editando código.
8. Reabrir tráfico gradualmente y vigilar errores, outbox, pagos, reservas e inventario.
9. Documentar pérdida real, RPO/RTO y acciones preventivas.
