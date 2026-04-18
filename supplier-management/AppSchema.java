package com.dairi.backend.model;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

/**
 * Represents an authorized entity schema (e.g. suppliers, patients, clinical-records).
 * Each schema corresponds to one module visible in the frontend sidebar.
 *
 * Table: app_schema
 */
@Entity
@Table(name = "app_schema")
public class AppSchema {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Machine-readable key used by the frontend router (e.g. "suppliers", "clinical-records"). */
    @Column(nullable = false, unique = true, length = 64)
    private String schemaKey;

    /** Human-readable singular name (e.g. "Proveedor", "Ficha Clínica"). */
    @Column(nullable = false, length = 128)
    private String singular;

    /** Human-readable plural name (e.g. "Proveedores", "Fichas Clínicas"). */
    @Column(nullable = false, length = 128)
    private String plural;

    /** Icon identifier used by the frontend (e.g. "truck", "clipboard"). */
    @Column(length = 64)
    private String icon;

    /**
     * Module layout type: "list" | "calendar" | "clinical-record".
     * Determines which frontend component renders this schema.
     */
    @Column(length = 32)
    private String moduleType;

    /** Users who have access to this schema. */
    @ManyToMany(mappedBy = "schemas")
    private Set<User> users = new HashSet<>();

    // ── Constructors ──────────────────────────────────────────────────────────

    public AppSchema() {}

    public AppSchema(String schemaKey, String singular, String plural, String icon, String moduleType) {
        this.schemaKey  = schemaKey;
        this.singular   = singular;
        this.plural     = plural;
        this.icon       = icon;
        this.moduleType = moduleType;
    }

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public Long getId()                  { return id; }
    public void setId(Long id)           { this.id = id; }

    public String getSchemaKey()                 { return schemaKey; }
    public void   setSchemaKey(String schemaKey) { this.schemaKey = schemaKey; }

    public String getSingular()                { return singular; }
    public void   setSingular(String singular) { this.singular = singular; }

    public String getPlural()              { return plural; }
    public void   setPlural(String plural) { this.plural = plural; }

    public String getIcon()            { return icon; }
    public void   setIcon(String icon) { this.icon = icon; }

    public String getModuleType()                { return moduleType; }
    public void   setModuleType(String moduleType){ this.moduleType = moduleType; }

    public Set<User> getUsers()              { return users; }
    public void      setUsers(Set<User> users){ this.users = users; }

    @Override
    public String toString() {
        return "AppSchema{key='" + schemaKey + "', plural='" + plural + "'}";
    }
}
