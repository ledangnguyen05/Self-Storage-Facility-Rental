package com.boxora.repository;

import com.boxora.entity.FeeType;
import com.boxora.enums.FeeCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FeeTypeRepository extends JpaRepository<FeeType, UUID> {
    Optional<FeeType> findByCode(String code);
    boolean existsByCode(String code);
    List<FeeType> findByIsActiveTrue();
    List<FeeType> findByFeeCategoryAndIsActiveTrue(FeeCategory category);
}

