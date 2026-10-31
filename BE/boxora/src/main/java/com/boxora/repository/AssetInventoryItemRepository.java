package com.boxora.repository;

import com.boxora.entity.AssetInventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AssetInventoryItemRepository extends JpaRepository<AssetInventoryItem, UUID> {
    List<AssetInventoryItem> findBySealingRecord_Id(UUID sealingRecordId);
}
