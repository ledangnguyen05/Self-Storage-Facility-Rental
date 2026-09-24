package com.boxora.entity;

import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.OverrideSeverity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "master_key_overrides")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterKeyOverride extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by_id", nullable = false)
    private User performedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "witness_id", nullable = false)
    private User witness;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 50)
    private MasterKeyOverrideCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 30)
    private OverrideSeverity severity;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Column(name = "document_reference", length = 100)
    private String documentReference;

    // optional link to what the override was used to access, e.g. a StorageUnit
    @Column(name = "resource_type", length = 100)
    private String resourceType;

    @Column(name = "resource_id")
    private UUID resourceId;
}