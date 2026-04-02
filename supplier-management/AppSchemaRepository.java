package com.dairi.backend.repository;

import com.dairi.backend.model.AppSchema;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AppSchemaRepository extends JpaRepository<AppSchema, Long> {

    Optional<AppSchema> findBySchemaKey(String schemaKey);

    boolean existsBySchemaKey(String schemaKey);
}
