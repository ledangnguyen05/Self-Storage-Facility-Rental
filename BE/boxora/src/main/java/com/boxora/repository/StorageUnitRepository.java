package com.boxora.repository;

import com.boxora.entity.StorageUnit;
import com.boxora.enums.UnitStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StorageUnitRepository extends JpaRepository<StorageUnit, UUID>, JpaSpecificationExecutor<StorageUnit> {

    @EntityGraph(attributePaths = {"facility", "unitType"})
    Optional<StorageUnit> findWithDetailsById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"facility", "unitType"})
    @Query("SELECT su FROM StorageUnit su WHERE su.id = :id")
    Optional<StorageUnit> findWithDetailsByIdForUpdate(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_Id(UUID facilityId);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_IdAndFloorLevel(UUID facilityId, String floorLevel);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_IdAndStatus(UUID facilityId, UnitStatus status);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_IdAndFloorLevelAndStatus(UUID facilityId, String floorLevel, UnitStatus status);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByStatus(UnitStatus status);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_IdAndUnitType_IdAndStatus(
            UUID facilityId,
            UUID unitTypeId,
            UnitStatus status
    );

    boolean existsByFacility_IdAndUnitCode(UUID facilityId, String unitCode);

    boolean existsByFacility_IdAndUnitCodeAndIdNot(UUID facilityId, String unitCode, UUID id);

    /** Mã kho là duy nhất trong cơ sở KHÔNG phân biệt hoa thường: {@code D1-A101} và {@code d1-a101} là cùng một mã. */
    boolean existsByFacility_IdAndUnitCodeIgnoreCase(UUID facilityId, String unitCode);

    boolean existsByFacility_IdAndUnitCodeIgnoreCaseAndIdNot(UUID facilityId, String unitCode, UUID id);

    boolean existsByUnitType_Id(UUID unitTypeId);

    boolean existsByFacility_Id(UUID facilityId);

    long countByFacility_IdAndStatusIn(UUID facilityId, java.util.Collection<UnitStatus> statuses);

    /** Đếm kho theo cơ sở và trạng thái trong một truy vấn (không N+1): [facilityId, status, count]. */
    @Query("""
            SELECT su.facility.id, su.status, COUNT(su)
            FROM StorageUnit su
            WHERE su.facility.id IN :facilityIds
            GROUP BY su.facility.id, su.status
            """)
    List<Object[]> countByFacilityIdsGroupedByStatus(@Param("facilityIds") java.util.Collection<UUID> facilityIds);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    @Query("SELECT su FROM StorageUnit su")
    List<StorageUnit> findAllWithDetails();

    /**
     * Kho đang trống theo loại và cơ sở đang hoạt động: [unitTypeId, facilityId, min(pricePerMonth)]; dùng cho "giá từ".
     * Kho đã có đặt kho còn hiệu lực không tính là trống dù cột trạng thái chưa cập nhật.
     */
    @Query("""
            SELECT su.unitType.id, su.facility.id, MIN(su.pricePerMonth)
            FROM StorageUnit su
            WHERE su.status = com.boxora.enums.UnitStatus.AVAILABLE
              AND su.facility.status = com.boxora.enums.FacilityStatus.ACTIVE
              AND NOT EXISTS (
                  SELECT b.id FROM Booking b
                  WHERE b.storageUnit = su
                    AND b.status NOT IN (com.boxora.enums.BookingStatus.COMPLETED, com.boxora.enums.BookingStatus.CANCELLED))
            GROUP BY su.unitType.id, su.facility.id
            """)
    List<Object[]> findAvailableMinPriceByTypeAndFacility();

    /**
     * Số kho đang ghi {@code AVAILABLE} nhưng đã có đặt kho còn hiệu lực, theo cơ sở: [facilityId, count].
     * Trừ số này khỏi số kho trống để "Kho trống" không đếm kho đã có người giữ.
     */
    @Query("""
            SELECT su.facility.id, COUNT(su)
            FROM StorageUnit su
            WHERE su.facility.id IN :facilityIds
              AND su.status = com.boxora.enums.UnitStatus.AVAILABLE
              AND EXISTS (
                  SELECT b.id FROM Booking b
                  WHERE b.storageUnit = su
                    AND b.status NOT IN (com.boxora.enums.BookingStatus.COMPLETED, com.boxora.enums.BookingStatus.CANCELLED))
            GROUP BY su.facility.id
            """)
    List<Object[]> countAvailableWithLiveBookingByFacilityIds(@Param("facilityIds") java.util.Collection<UUID> facilityIds);

    long countByUnitType_Id(UUID unitTypeId);

    List<StorageUnit> findByUnitType_Id(UUID unitTypeId);

    @Query("""
            SELECT su.facility.id, su.facility.name, su.status, COUNT(su)
            FROM StorageUnit su
            GROUP BY su.facility.id, su.facility.name, su.status
            """)
    List<Object[]> countUnitsGroupedByFacilityAndStatus();
}