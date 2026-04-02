package com.dairi.backend.config;

import com.dairi.backend.model.AppSchema;
import com.dairi.backend.model.User;
import com.dairi.backend.model.UserRole;
import com.dairi.backend.repository.AppSchemaRepository;
import com.dairi.backend.repository.UserRepository;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Seeds the database with the initial users and authorized schemas
 * that match the MOCK_USERS array defined in the Angular frontend
 * (src/app/services/auth.service.ts).
 *
 * Runs automatically on application startup.
 * Controlled by the config property "app.data-loader.enabled" (default: true).
 * Set to false in production: app.data-loader.enabled=false
 *
 * Idempotent: each entity is only inserted if it does not already exist
 * (checked by unique key before persisting).
 */
@ApplicationScoped
public class DataLoader {

    private static final Logger log = Logger.getLogger(DataLoader.class);

    @Inject AppSchemaRepository schemaRepo;
    @Inject UserRepository      userRepo;

    @ConfigProperty(name = "app.data-loader.enabled", defaultValue = "true")
    boolean enabled;

    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void onStart(@Observes StartupEvent event) {
        if (!enabled) {
            log.info("DataLoader disabled — skipping seed.");
            return;
        }

        log.info("=== DataLoader: seeding database ===");

        // ── 1. Persist all schemas ────────────────────────────────────────────
        AppSchema suppliers       = persistSchema("suppliers",        "Proveedor",        "Proveedores",           "truck",       "list");
        AppSchema products        = persistSchema("products",         "Producto",         "Productos",             "box",         "list");
        AppSchema patients        = persistSchema("patients",         "Paciente",         "Pacientes",             "user",        "list");
        AppSchema appointments    = persistSchema("appointments",     "Cita",             "Citas",                 "calendar",    "calendar");
        AppSchema clinicalRecords = persistSchema("clinical-records", "Ficha Clínica",    "Fichas Clínicas",       "clipboard",   "clinical-record");
        AppSchema payments        = persistSchema("payments",         "Pago",             "Pagos",                 "credit-card", "list");
        AppSchema expenses        = persistSchema("expenses",         "Gasto",            "Gastos",                "receipt",     "list");
        AppSchema psychSessions   = persistSchema("psych-sessions",   "Sesión",           "Sesiones Psicológicas", "calendar",    "calendar");
        AppSchema psychRecords    = persistSchema("psych-records",    "Ficha Psicológica","Fichas Psicológicas",   "clipboard",   "clinical-record");
        AppSchema dentalSessions  = persistSchema("dental-sessions",  "Sesión Dental",    "Sesiones Dentales",     "calendar",    "calendar");
        AppSchema dentalRecords   = persistSchema("dental-records",   "Ficha Dental",     "Fichas Dentales",       "clipboard",   "clinical-record");

        // ── 2. Persist all users ──────────────────────────────────────────────

        // admin@empresa.com — acceso a todos los módulos
        User admin = persistUser("Admin General", "admin@empresa.com", "admin123", UserRole.admin, "AG");
        admin.addSchema(suppliers);
        admin.addSchema(products);
        admin.addSchema(patients);
        admin.addSchema(appointments);
        admin.addSchema(clinicalRecords);
        admin.addSchema(payments);
        admin.addSchema(expenses);
        userRepo.persist(admin);
        log.infof("  Saved user: %s", admin);

        // compras@empresa.com — gestión de compras y gastos
        User compras = persistUser("Jefe de Compras", "compras@empresa.com", "compras123", UserRole.manager, "JC");
        compras.addSchema(suppliers);
        compras.addSchema(products);
        compras.addSchema(payments);
        compras.addSchema(expenses);
        userRepo.persist(compras);
        log.infof("  Saved user: %s", compras);

        // medico@hospital.com — módulos clínicos de medicina general
        User medico = persistUser("Dra. Morales", "medico@hospital.com", "medico123", UserRole.manager, "DM");
        medico.addSchema(patients);
        medico.addSchema(appointments);
        medico.addSchema(clinicalRecords);
        medico.addSchema(payments);
        userRepo.persist(medico);
        log.infof("  Saved user: %s", medico);

        // auditor@empresa.com — solo lectura sobre proveedores, pagos y gastos
        User auditor = persistUser("Auditor", "auditor@empresa.com", "viewer123", UserRole.viewer, "AU");
        auditor.addSchema(suppliers);
        auditor.addSchema(payments);
        auditor.addSchema(expenses);
        userRepo.persist(auditor);
        log.infof("  Saved user: %s", auditor);

        // psicologia@clinica.com — sesiones y fichas psicológicas
        User psico = persistUser("Ps. Carolina Vega", "psicologia@clinica.com", "psico123", UserRole.manager, "CV");
        psico.addSchema(psychSessions);
        psico.addSchema(psychRecords);
        userRepo.persist(psico);
        log.infof("  Saved user: %s", psico);

        // odontologia@clinica.com — sesiones y fichas dentales
        User denti = persistUser("Dr. Ramírez", "odontologia@clinica.com", "denti123", UserRole.manager, "DR");
        denti.addSchema(dentalSessions);
        denti.addSchema(dentalRecords);
        userRepo.persist(denti);
        log.infof("  Saved user: %s", denti);

        log.infof("=== DataLoader: seeding complete (%d users, %d schemas) ===",
            userRepo.count(), schemaRepo.count());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Inserts a schema only if its key does not already exist.
     * Returns the managed entity in either case.
     */
    private AppSchema persistSchema(String key, String singular, String plural,
                                    String icon, String moduleType) {
        return schemaRepo.findBySchemaKey(key).orElseGet(() -> {
            AppSchema s = new AppSchema(key, singular, plural, icon, moduleType);
            schemaRepo.persist(s);
            log.infof("  Saved schema: %s", s);
            return s;
        });
    }

    /**
     * Inserts a user only if its email does not already exist.
     * NOTE: hash the password with BcryptUtil before persisting in production.
     * Example: BcryptUtil.bcryptHash(rawPassword)
     */
    private User persistUser(String name, String email, String rawPassword,
                              UserRole role, String avatar) {
        return userRepo.findByEmail(email).orElseGet(() ->
            new User(name, email, rawPassword, role, avatar)
        );
    }
}
