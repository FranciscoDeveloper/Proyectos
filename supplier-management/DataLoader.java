package com.dairi.backend.config;

import com.dairi.backend.model.AppSchema;
import com.dairi.backend.model.User;
import com.dairi.backend.model.UserRole;
import com.dairi.backend.repository.AppSchemaRepository;
import com.dairi.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds the database with the initial users and authorized schemas
 * that match the MOCK_USERS array defined in the Angular frontend
 * (src/app/services/auth.service.ts).
 *
 * Runs automatically on startup only when the "dev" or "staging" Spring profile
 * is active. Skip in production by not activating those profiles.
 *
 * Idempotent: each entity is only inserted if it does not already exist
 * (checked by unique key before persisting).
 */
@Component
@Profile({ "dev", "staging" })
public class DataLoader implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataLoader.class);

    private final AppSchemaRepository schemaRepo;
    private final UserRepository      userRepo;
    private final PasswordEncoder     passwordEncoder;

    public DataLoader(AppSchemaRepository schemaRepo,
                      UserRepository userRepo,
                      PasswordEncoder passwordEncoder) {
        this.schemaRepo      = schemaRepo;
        this.userRepo        = userRepo;
        this.passwordEncoder = passwordEncoder;
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void run(String... args) {
        log.info("=== DataLoader: seeding database ===");

        // ── 1. Persist all schemas ────────────────────────────────────────────
        AppSchema suppliers       = persistSchema("suppliers",        "Proveedor",       "Proveedores",              "truck",      "list");
        AppSchema products        = persistSchema("products",         "Producto",        "Productos",                "box",        "list");
        AppSchema patients        = persistSchema("patients",         "Paciente",        "Pacientes",                "user",       "list");
        AppSchema appointments    = persistSchema("appointments",     "Cita",            "Citas",                    "calendar",   "calendar");
        AppSchema clinicalRecords = persistSchema("clinical-records", "Ficha Clínica",   "Fichas Clínicas",          "clipboard",  "clinical-record");
        AppSchema payments        = persistSchema("payments",         "Pago",            "Pagos",                    "credit-card","list");
        AppSchema expenses        = persistSchema("expenses",         "Gasto",           "Gastos",                   "receipt",    "list");
        AppSchema psychSessions   = persistSchema("psych-sessions",   "Sesión",          "Sesiones Psicológicas",    "calendar",   "calendar");
        AppSchema psychRecords    = persistSchema("psych-records",    "Ficha Psicológica","Fichas Psicológicas",     "clipboard",  "clinical-record");
        AppSchema dentalSessions  = persistSchema("dental-sessions",  "Sesión Dental",   "Sesiones Dentales",        "calendar",   "calendar");
        AppSchema dentalRecords   = persistSchema("dental-records",   "Ficha Dental",    "Fichas Dentales",          "clipboard",  "clinical-record");

        // ── 2. Persist all users ──────────────────────────────────────────────

        // admin@empresa.com — acceso a todos los módulos
        User admin = persistUser(
            "Admin General",
            "admin@empresa.com",
            "admin123",
            UserRole.admin,
            "AG"
        );
        admin.addSchema(suppliers);
        admin.addSchema(products);
        admin.addSchema(patients);
        admin.addSchema(appointments);
        admin.addSchema(clinicalRecords);
        admin.addSchema(payments);
        admin.addSchema(expenses);
        userRepo.save(admin);
        log.info("  Saved user: {}", admin);

        // compras@empresa.com — gestión de compras y gastos
        User compras = persistUser(
            "Jefe de Compras",
            "compras@empresa.com",
            "compras123",
            UserRole.manager,
            "JC"
        );
        compras.addSchema(suppliers);
        compras.addSchema(products);
        compras.addSchema(payments);
        compras.addSchema(expenses);
        userRepo.save(compras);
        log.info("  Saved user: {}", compras);

        // medico@hospital.com — módulos clínicos de medicina general
        User medico = persistUser(
            "Dra. Morales",
            "medico@hospital.com",
            "medico123",
            UserRole.manager,
            "DM"
        );
        medico.addSchema(patients);
        medico.addSchema(appointments);
        medico.addSchema(clinicalRecords);
        medico.addSchema(payments);
        userRepo.save(medico);
        log.info("  Saved user: {}", medico);

        // auditor@empresa.com — solo lectura sobre proveedores, pagos y gastos
        User auditor = persistUser(
            "Auditor",
            "auditor@empresa.com",
            "viewer123",
            UserRole.viewer,
            "AU"
        );
        auditor.addSchema(suppliers);
        auditor.addSchema(payments);
        auditor.addSchema(expenses);
        userRepo.save(auditor);
        log.info("  Saved user: {}", auditor);

        // psicologia@clinica.com — sesiones y fichas psicológicas
        User psico = persistUser(
            "Ps. Carolina Vega",
            "psicologia@clinica.com",
            "psico123",
            UserRole.manager,
            "CV"
        );
        psico.addSchema(psychSessions);
        psico.addSchema(psychRecords);
        userRepo.save(psico);
        log.info("  Saved user: {}", psico);

        // odontologia@clinica.com — sesiones y fichas dentales
        User denti = persistUser(
            "Dr. Ramírez",
            "odontologia@clinica.com",
            "denti123",
            UserRole.manager,
            "DR"
        );
        denti.addSchema(dentalSessions);
        denti.addSchema(dentalRecords);
        userRepo.save(denti);
        log.info("  Saved user: {}", denti);

        log.info("=== DataLoader: seeding complete ({} users, {} schemas) ===",
            userRepo.count(), schemaRepo.count());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Inserts a schema only if its key does not already exist in the database.
     * Returns the managed entity in either case.
     */
    private AppSchema persistSchema(String key, String singular, String plural,
                                    String icon, String moduleType) {
        return schemaRepo.findBySchemaKey(key).orElseGet(() -> {
            AppSchema s = new AppSchema(key, singular, plural, icon, moduleType);
            AppSchema saved = schemaRepo.save(s);
            log.info("  Saved schema: {}", saved);
            return saved;
        });
    }

    /**
     * Inserts a user only if its email does not already exist in the database.
     * The password is BCrypt-hashed before persisting.
     * Returns the managed entity (without schema associations — caller adds those).
     */
    private User persistUser(String name, String email, String rawPassword,
                              UserRole role, String avatar) {
        return userRepo.findByEmail(email).orElseGet(() -> {
            User u = new User(name, email, passwordEncoder.encode(rawPassword), role, avatar);
            return userRepo.save(u);
        });
    }
}
