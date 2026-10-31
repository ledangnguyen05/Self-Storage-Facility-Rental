package com.boxora.validator;

import com.boxora.entity.StorageUnit;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.StorageUnitRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class FloorPlanValidator {

    private final ObjectMapper objectMapper;
    private final StorageUnitRepository storageUnitRepository;

    /**
     * Validates floor plan configuration inside layoutConfig JSON.
     * @param layoutConfig JSON string
     * @param facilityId UUID of facility (null when creating a new facility)
     */
    public void validateFloorPlan(String layoutConfig, UUID facilityId) {
        if (layoutConfig == null || layoutConfig.trim().isEmpty()) {
            return;
        }

        try {
            JsonNode root = objectMapper.readTree(layoutConfig);
            JsonNode floorsNode = root.get("floors");

            // If floors node is not present or not an array, it's either legacy v1 format or empty
            if (floorsNode == null || !floorsNode.isArray() || floorsNode.isEmpty()) {
                return;
            }

            Set<String> floorCodes = new HashSet<>();
            Set<String> zoneCodes = new HashSet<>();
            Set<String> functionalAreaCodes = new HashSet<>();
            Set<String> validFloorIdentifiers = new HashSet<>();

            for (JsonNode floor : floorsNode) {
                String floorName = floor.path("name").asText("").trim();
                String floorCode = floor.path("code").asText("").trim();
                double totalArea = floor.path("totalArea").asDouble(0.0);

                if (floorName.isEmpty() || floorCode.isEmpty()) {
                    throw new AppException(ErrorCode.FLOOR_PLAN_INVALID);
                }

                String floorCodeLower = floorCode.toLowerCase();
                if (!floorCodes.add(floorCodeLower)) {
                    throw new AppException(ErrorCode.FLOOR_CODE_DUPLICATE);
                }

                if (totalArea <= 0.0) {
                    throw new AppException(ErrorCode.FLOOR_PLAN_INVALID);
                }

                validFloorIdentifiers.add(floorName.toLowerCase());
                validFloorIdentifiers.add(floorCodeLower);
                if (floor.has("floorNumber")) {
                    validFloorIdentifiers.add(String.valueOf(floor.get("floorNumber").asInt()));
                }

                double zonesAndAreasTotal = 0.0;

                // Validate Zones
                JsonNode zonesNode = floor.get("zones");
                if (zonesNode != null && zonesNode.isArray()) {
                    for (JsonNode zone : zonesNode) {
                        String zoneName = zone.path("name").asText("").trim();
                        String zoneCode = zone.path("code").asText("").trim();
                        double zoneArea = zone.path("area").asDouble(0.0);

                        if (zoneName.isEmpty() || zoneCode.isEmpty()) {
                            throw new AppException(ErrorCode.FLOOR_PLAN_INVALID);
                        }

                        String zoneCodeLower = zoneCode.toLowerCase();
                        if (!zoneCodes.add(zoneCodeLower)) {
                            throw new AppException(ErrorCode.ZONE_CODE_DUPLICATE);
                        }

                        if (zoneArea <= 0.0) {
                            throw new AppException(ErrorCode.FLOOR_PLAN_INVALID);
                        }
                        zonesAndAreasTotal += zoneArea;
                    }
                }

                // Validate Functional Areas
                JsonNode faNode = floor.get("functionalAreas");
                if (faNode != null && faNode.isArray()) {
                    for (JsonNode fa : faNode) {
                        String faName = fa.path("name").asText("").trim();
                        String faCode = fa.path("code").asText("").trim();

                        if (faName.isEmpty() || faCode.isEmpty()) {
                            throw new AppException(ErrorCode.FLOOR_PLAN_INVALID);
                        }

                        String faCodeLower = faCode.toLowerCase();
                        if (!functionalAreaCodes.add(faCodeLower)) {
                            throw new AppException(ErrorCode.FUNCTIONAL_AREA_CODE_DUPLICATE);
                        }

                        if (fa.has("area") && !fa.get("area").isNull()) {
                            double faArea = fa.path("area").asDouble(0.0);
                            if (faArea > 0.0) {
                                zonesAndAreasTotal += faArea;
                            }
                        }
                    }
                }

                // Rule 6: Sum of zones and functional areas cannot exceed floor total area
                if (zonesAndAreasTotal > (totalArea + 0.05)) { // 0.05 tolerance for floating point
                    log.warn("Floor {} total area ({}) exceeded by zones and functional areas ({})",
                            floorCode, totalArea, zonesAndAreasTotal);
                    throw new AppException(ErrorCode.FLOOR_AREA_EXCEEDED);
                }
            }

            // Referential integrity: When facility already exists, check that existing storage units are not orphaned
            if (facilityId != null) {
                List<StorageUnit> existingUnits = storageUnitRepository.findByFacility_Id(facilityId);
                for (StorageUnit unit : existingUnits) {
                    String fl = unit.getFloorLevel();
                    if (fl != null && !fl.trim().isEmpty()) {
                        String flNorm = fl.trim().toLowerCase();
                        boolean matchesAnyFloor = validFloorIdentifiers.contains(flNorm)
                                || validFloorIdentifiers.contains("tầng " + flNorm)
                                || validFloorIdentifiers.contains("tang " + flNorm)
                                || validFloorIdentifiers.contains("fl-" + flNorm)
                                || validFloorIdentifiers.contains("floor " + flNorm);
                        if (!matchesAnyFloor) {
                            log.error("Cannot remove floor '{}' because storage unit '{}' (ID: {}) is assigned to it",
                                    fl, unit.getUnitCode(), unit.getId());
                            throw new AppException(ErrorCode.FLOOR_CANNOT_BE_DELETED_IN_USE);
                        }
                    }
                }
            }

        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse floor plan JSON config: {}", e.getMessage());
            throw new AppException(ErrorCode.FLOOR_PLAN_INVALID);
        }
    }
}
