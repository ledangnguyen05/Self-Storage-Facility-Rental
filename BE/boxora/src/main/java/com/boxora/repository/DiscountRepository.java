package com.boxora.repository;

import com.boxora.entity.Discount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DiscountRepository extends JpaRepository<Discount, UUID> {
    Optional<Discount> findByCode(String code);
    boolean existsByCode(String code);

    /** Tăng lượt dùng nguyên tử; trả 0 nếu mã không tồn tại hoặc đã hết lượt. */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("""
            UPDATE Discount d SET d.usedCount = d.usedCount + 1
            WHERE d.code = :code AND (d.usageLimit IS NULL OR d.usedCount < d.usageLimit)
            """)
    int incrementUsedCount(@Param("code") String code);

    @Query("""
            SELECT d FROM Discount d
            WHERE d.isActive = TRUE
              AND d.startDate <= :today
              AND (d.endDate IS NULL OR d.endDate >= :today)
              AND (:facilityId IS NULL OR d.facility IS NULL OR d.facility.id = :facilityId)
            """)
    List<Discount> findActiveDiscounts(@Param("today") LocalDate today, @Param("facilityId") UUID facilityId);
}

