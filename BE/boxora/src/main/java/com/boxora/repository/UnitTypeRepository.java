package com.boxora.repository;

import com.boxora.entity.UnitType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UnitTypeRepository extends JpaRepository<UnitType, UUID> {

    boolean existsByTypeNameIgnoreCase(String typeName);

    boolean existsByTypeNameIgnoreCaseAndIdNot(String typeName, UUID id);

    Optional<UnitType> findByTypeNameIgnoreCase(String typeName);

    List<UnitType> findAllByOrderByCreatedAtAsc();

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT ut FROM UnitType ut WHERE ut.id = :id")
    Optional<UnitType> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);
}
