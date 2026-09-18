package com.boxora.repository;

import com.boxora.entity.StorageUnit;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StorageUnitRepository extends MongoRepository<StorageUnit, UUID> {
    List<StorageUnit> findByFacility_Id(UUID facilityId);
    List<StorageUnit> findByFacility_IdAndFloorLevel(UUID facilityId, String floorLevel);
    List<StorageUnit> findByStatus(String status);
    Optional<StorageUnit> findByUnitCode(String unitCode);
    Optional<StorageUnit> findByFacility_IdAndUnitCode(UUID facilityId, String unitCode);
}
