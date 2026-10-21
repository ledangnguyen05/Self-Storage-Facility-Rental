package com.boxora.repository;

import com.boxora.entity.Facility;
import com.boxora.enums.FacilityStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FacilityRepository extends JpaRepository<Facility, UUID> {
    List<Facility> findAllByOrderByCreatedAtAsc();
    Optional<Facility> findByCode(String code);
    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, UUID id);

    /** Mã cơ sở là duy nhất KHÔNG phân biệt hoa thường: {@code QA-01} và {@code qa-01} là cùng một mã. */
    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, UUID id);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

    @Query("""
        SELECT f FROM Facility f
        WHERE (:search IS NULL
            OR LOWER(f.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
            OR LOWER(f.code) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
            OR LOWER(f.city) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
        AND (:status IS NULL OR f.status = :status)
        AND (:scopedFacilityId IS NULL OR f.id = :scopedFacilityId)
        """)
    Page<Facility> findAllWithFilters(
            @Param("search") String search,
            @Param("status") FacilityStatus status,
            @Param("scopedFacilityId") UUID scopedFacilityId,
            Pageable pageable
    );
}