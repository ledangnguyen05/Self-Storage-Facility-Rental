package com.boxora.repository;

import com.boxora.entity.Permission;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PermissionRepository extends MongoRepository<Permission, UUID>, PermissionRepositoryCustom {

    Optional<Permission> findByName(String name);

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, UUID id);

    boolean existsByPermissionGroup(String permissionGroup);

    boolean existsByPermissionGroupAndIdNot(String permissionGroup, UUID id);
}

