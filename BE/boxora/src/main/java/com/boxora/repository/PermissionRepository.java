package com.boxora.repository;

import com.boxora.entity.Permission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    Optional<Permission> findByName(String name);

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, UUID id);

    boolean existsByPermissionGroup(String permissionGroup);

    boolean existsByPermissionGroupAndIdNot(String permissionGroup, UUID id);

    @Query("""
            SELECT p FROM Permission p
            WHERE (:search IS NULL
                OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                OR LOWER(p.permissionGroup) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                OR LOWER(p.description) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
            AND (:isActive IS NULL OR p.isActive = :isActive)
            """)
    Page<Permission> findAllWithFilters(
            @Param("search") String search,
            @Param("isActive") Boolean isActive,
            Pageable pageable
    );
}
