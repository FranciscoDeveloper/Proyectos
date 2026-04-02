package com.dairi.backend.repository;

import com.dairi.backend.model.AppSchema;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

@ApplicationScoped
public class AppSchemaRepository implements PanacheRepository<AppSchema> {

    public Optional<AppSchema> findBySchemaKey(String schemaKey) {
        return find("schemaKey", schemaKey).firstResultOptional();
    }

    public boolean existsBySchemaKey(String schemaKey) {
        return count("schemaKey", schemaKey) > 0;
    }
}
