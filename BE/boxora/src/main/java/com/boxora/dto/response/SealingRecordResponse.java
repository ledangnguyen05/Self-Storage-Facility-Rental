package com.boxora.dto.response;

import com.boxora.enums.SealingStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Phản hồi thông tin biên bản niêm phong kho lưu trữ (BR-RULE-012)")
public class SealingRecordResponse {

    private UUID id;

    // Unit
    private UUID storageUnitId;
    private String unitCode;

    // Contract
    private UUID contractId;
    private String contractCode;

    // Facility
    private UUID facilityId;
    private String facilityName;

    // Sealing info
    private String sealTagNumber;
    private String reason;
    private LocalDateTime sealedAt;

    private UUID sealedById;
    private String sealedByName;

    private UUID witnessId;
    private String witnessName;

    private SealingStatus status;

    // Unseal info
    private LocalDateTime unsealedAt;
    private UUID unsealedById;
    private String unsealedByName;
    private String unsealReason;

    private String photoEvidenceUrl;
    private String notes;

    private String protocolNumber;
    private UUID unitId;
    private UUID customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private UUID performedById;
    private String performedByName;
    private Long overdueDays;
    private java.math.BigDecimal totalDebtAmount;
    private String inventorySummary;
    private String evidenceUrls;

    public UUID getUnitId() {
        return unitId != null ? unitId : storageUnitId;
    }

    public UUID getPerformedById() {
        return performedById != null ? performedById : sealedById;
    }

    public String getPerformedByName() {
        return performedByName != null ? performedByName : sealedByName;
    }

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Printable protocol details
    private String facilityAddress;
    private String facilityPhone;
    private java.time.LocalDate contractStartDate;
    private java.time.LocalDate contractEndDate;
    private String sealedByRole;
    private String witnessRole;

    /** True only when the notice email was accepted by the mail server; null when no email applies. */
    private Boolean customerNotified;
    /** Vietnamese explanation of the email outcome (sent to whom, or why not). */
    private String notificationMessage;
    /** After unsealing: what happened to the tenant access. */
    private AccessRestorationResponse accessRestoration;
}
