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
}
