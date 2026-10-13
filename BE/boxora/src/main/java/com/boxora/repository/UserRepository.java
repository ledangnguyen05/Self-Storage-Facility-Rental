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

    @EntityGraph(attributePaths = {"role", "facility"})
    Optional<User> findByEmail(String email);

    @EntityGraph(attributePaths = {"role", "facility"})
    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByUsernameAndIdNot(String username, UUID id);
    boolean existsByEmailAndIdNot(String email, UUID id);
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

    List<User> findAllByRole_NameInAndIsActiveTrue(List<String> roleNames);
}
