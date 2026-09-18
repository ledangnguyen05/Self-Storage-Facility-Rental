package com.boxora.repository;

import com.boxora.entity.RolePermission;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RolePermissionRepository extends MongoRepository<RolePermission, UUID>, RolePermissionRepositoryCustom {

    @Query(value = "{ 'role.$id': ?0, 'permission.$id': ?1 }", exists = true)
    boolean existsByRole_IdAndPermission_Id(UUID roleId, UUID permissionId);

    @Query("{ 'role.$id': ?0, 'permission.$id': ?1 }")
    Optional<RolePermission> findByRole_IdAndPermission_Id(UUID roleId, UUID permissionId);

    @Query("{ 'role.$id': ?0 }")
    List<RolePermission> findAllByRole_Id(UUID roleId);

    @Query("{ 'permission.$id': ?0 }")
    List<RolePermission> findAllByPermission_Id(UUID permissionId);

    default List<RolePermission> findAllByRole_IdAndIsActiveTrueAndPermission_IsActiveTrue(UUID roleId) {
        return findAllActiveByRoleId(roleId);
    }

    @Query("{ 'role.$id': ?0, 'permission.$id': { $in: ?1 } }")
    List<RolePermission> findAllByRole_IdAndPermission_IdIn(UUID roleId, List<UUID> permissionIds);

    @Query(value = "{ 'role.$id': ?0 }", delete = true)
    void deleteAllByRole_Id(UUID roleId);
}

