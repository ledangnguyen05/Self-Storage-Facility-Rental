package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "facility_policy_exception_grants",
        uniqueConstraints = @UniqueConstraint(columnNames = {"facility_policy_id", "user_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityPolicyExceptionGrant extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facility_policy_id", nullable = false)
    private FacilityPolicy facilityPolicy;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "granted_by_user_id", nullable = false)
    private User grantedBy;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
