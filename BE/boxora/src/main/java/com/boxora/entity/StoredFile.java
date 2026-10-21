package com.boxora.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * One file stored under /uploads. The row records who uploaded it and, once known, which booking and facility it
 * belongs to, so that the API can decide who may receive a signed link and can reject evidence that was uploaded
 * for another record.
 */
@Entity
@Table(name = "stored_files")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoredFile extends BaseEntity {

    /** Public path of the file, e.g. /uploads/handover/9f1c.jpg. Unique. */
    @Column(name = "url_path", nullable = false, unique = true, length = 300)
    private String urlPath;

    /** The sub directory it was stored in: handover, tickets, refunds... */
    @Column(name = "category", nullable = false, length = 40)
    private String category;

    @Column(name = "original_name", length = 255)
    private String originalName;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "uploaded_by_id")
    private UUID uploadedById;

    @Column(name = "facility_id")
    private UUID facilityId;

    @Column(name = "booking_id")
    private UUID bookingId;
}
