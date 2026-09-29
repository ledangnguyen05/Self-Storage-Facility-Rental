package com.boxora.repository;

import com.boxora.entity.UnitType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface UnitTypeRepository extends JpaRepository<UnitType, UUID> {
}
