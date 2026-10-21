package com.boxora.repository;

import com.boxora.entity.StorageUnit;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.util.List;
import java.util.UUID;

/** Storage-unit aggregates for the occupancy report and the chatbot's live catalogue. */
public interface UnitReportRepository extends Repository<StorageUnit, UUID> {

    /**
     * Row layout: {@code [facilityId, facilityName, unitStatus, COUNT]}. Starts from facilities, so a facility
     * without units still yields one row whose status is null and count is 0.
     */
    @Query("""
            SELECT f.id, f.name, su.status, COUNT(su.id)
            FROM Facility f
            LEFT JOIN StorageUnit su ON su.facility.id = f.id
            GROUP BY f.id, f.name, su.status
            ORDER BY f.name
            """)
    List<Object[]> countUnitsByFacilityAndStatus();

    /** Row layout: {@code [facilityId, unitTypeId, unitStatus, COUNT, MIN(pricePerMonth), MAX(pricePerMonth)]}. */
    @Query("""
            SELECT su.facility.id, su.unitType.id, su.status, COUNT(su.id), MIN(su.pricePerMonth), MAX(su.pricePerMonth)
            FROM StorageUnit su
            GROUP BY su.facility.id, su.unitType.id, su.status
            """)
    List<Object[]> summarizeUnitsByFacilityTypeAndStatus();
}
