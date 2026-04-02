package com.dairi.backend.model;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

/**
 * Application user with role-based access to entity schemas.
 *
 * Table: app_user
 *
 * Relationships:
 *   - ManyToMany with AppSchema via join table user_schema
 */
@Entity
@Table(name = "app_user")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Full display name shown in the UI. */
    @Column(nullable = false, length = 128)
    private String name;

    /** Login email — must be unique across all users. */
    @Column(nullable = false, unique = true, length = 256)
    private String email;

    /**
     * Hashed password.
     * Store a BCrypt hash in production — never plain text.
     * Example: passwordEncoder.encode("admin123")
     */
    @Column(nullable = false, length = 256)
    private String password;

    /** Role determines UI behaviour and coarse-grained permissions. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRole role;

    /**
     * Two-letter avatar initials displayed when no profile picture is set.
     * Derived from name in the frontend (e.g. "Admin General" → "AG").
     */
    @Column(length = 8)
    private String avatar;

    /**
     * Fine-grained authorization: the set of entity schemas this user can access.
     * Managed via join table user_schema (user_id, schema_id).
     */
    @ManyToMany(fetch = FetchType.EAGER, cascade = { CascadeType.PERSIST, CascadeType.MERGE })
    @JoinTable(
        name = "user_schema",
        joinColumns        = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "schema_id")
    )
    private Set<AppSchema> schemas = new HashSet<>();

    // ── Constructors ──────────────────────────────────────────────────────────

    public User() {}

    public User(String name, String email, String password, UserRole role, String avatar) {
        this.name     = name;
        this.email    = email;
        this.password = password;
        this.role     = role;
        this.avatar   = avatar;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public void addSchema(AppSchema schema) {
        this.schemas.add(schema);
        schema.getUsers().add(this);
    }

    public void removeSchema(AppSchema schema) {
        this.schemas.remove(schema);
        schema.getUsers().remove(this);
    }

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public Long getId()            { return id; }
    public void setId(Long id)     { this.id = id; }

    public String getName()              { return name; }
    public void   setName(String name)   { this.name = name; }

    public String getEmail()               { return email; }
    public void   setEmail(String email)   { this.email = email; }

    public String getPassword()                  { return password; }
    public void   setPassword(String password)   { this.password = password; }

    public UserRole getRole()              { return role; }
    public void     setRole(UserRole role) { this.role = role; }

    public String getAvatar()                { return avatar; }
    public void   setAvatar(String avatar)   { this.avatar = avatar; }

    public Set<AppSchema> getSchemas()                   { return schemas; }
    public void           setSchemas(Set<AppSchema> schemas) { this.schemas = schemas; }

    @Override
    public String toString() {
        return "User{id=" + id + ", email='" + email + "', role=" + role + "}";
    }
}
