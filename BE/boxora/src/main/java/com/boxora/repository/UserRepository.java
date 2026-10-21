package com.boxora.repository;

import com.boxora.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    @Override
    @EntityGraph(attributePaths = {"role", "facility"})
    Optional<User> findById(UUID id);

    /** Row-locked read, used to serialise changes that must be checked against sibling rows (shift roster overlap). */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") UUID id);

    /**
     * E-mail addresses are case-insensitive. The database holds the lower-case form (unique index on
     * lower(email)), but a caller may still pass "Ngoc@Gmail.com", so both sides are lower-cased here.
     */
    @EntityGraph(attributePaths = {"role", "facility"})
    @Query("SELECT u FROM User u WHERE LOWER(u.email) = LOWER(:email)")
    Optional<User> findByEmail(@Param("email") String email);

    @EntityGraph(attributePaths = {"role", "facility"})
    Optional<User> findByUsername(String username);

    @Query("SELECT COUNT(u) > 0 FROM User u WHERE LOWER(u.email) = LOWER(:email)")
    boolean existsByEmail(@Param("email") String email);
    boolean existsByUsername(String username);
    boolean existsByUsernameAndIdNot(String username, UUID id);
    @Query("SELECT COUNT(u) > 0 FROM User u WHERE LOWER(u.email) = LOWER(:email) AND u.id <> :id")
    boolean existsByEmailAndIdNot(@Param("email") String email, @Param("id") UUID id);
    boolean existsByRole_Id(UUID roleId);

    @EntityGraph(attributePaths = {"role", "facility"})
    @Query("""
            SELECT u FROM User u
            WHERE (:search IS NULL
                OR LOWER(u.username) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
            AND (:isActive IS NULL OR u.isActive = :isActive)
            AND (:roleId IS NULL OR u.role.id = :roleId)
            AND (:role IS NULL OR UPPER(u.role.name) = UPPER(CAST(:role AS string)))
            AND (:facilityId IS NULL OR u.facility.id = :facilityId)
            """)
    Page<User> findAllWithFilters(
            @Param("search") String search,
            @Param("isActive") Boolean isActive,
            @Param("roleId") UUID roleId,
            @Param("role") String role,
            @Param("facilityId") UUID facilityId,
            Pageable pageable
    );

    /** Rows of [role name, isActive, count] for the accounts matching the same filters as findAllWithFilters. */
    @Query("""
            SELECT r.name, u.isActive, COUNT(u) FROM User u LEFT JOIN u.role r
            WHERE (:search IS NULL
                OR LOWER(u.username) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
            AND (:isActive IS NULL OR u.isActive = :isActive)
            AND (:roleId IS NULL OR r.id = :roleId)
            AND (:role IS NULL OR UPPER(r.name) = UPPER(CAST(:role AS string)))
            AND (:facilityId IS NULL OR u.facility.id = :facilityId)
            GROUP BY r.name, u.isActive
            """)
    List<Object[]> countByRoleAndStatus(
            @Param("search") String search,
            @Param("isActive") Boolean isActive,
            @Param("roleId") UUID roleId,
            @Param("role") String role,
            @Param("facilityId") UUID facilityId
    );

    List<User> findAllByRole_NameInAndIsActiveTrue(List<String> roleNames);
    List<User> findByFacility_IdAndRole_Name(UUID facilityId, String roleName);
    List<User> findByRole_Name(String roleName);
}
