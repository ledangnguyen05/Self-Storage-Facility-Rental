package com.boxora.repository;

import com.boxora.entity.RefundRequest;
import com.boxora.entity.SupportTicket;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Finds the records that reference an uploaded file (by its /uploads/... path). The file endpoint and the signing
 * endpoint use it to decide who may see a file: only people who may see one of these records. Kept out of the domain
 * repositories on purpose, so it does not touch their interfaces.
 */
@Repository
public class UploadReferenceRepository {

    @PersistenceContext
    private EntityManager entityManager;

    /** Bookings whose handover records, counter payments or paper contract point at the file. */
    public Set<UUID> findBookingIdsReferencingHandoverFile(String path) {
        Set<UUID> ids = new LinkedHashSet<>();
        ids.addAll(entityManager.createQuery(
                        "select r.booking.id from HandoverRecord r where r.evidencePhotos like :pattern", UUID.class)
                .setParameter("pattern", likePattern(path))
                .getResultList());
        ids.addAll(entityManager.createQuery(
                        "select p.booking.id from Payment p where p.proofDocumentUrl = :path and p.booking is not null", UUID.class)
                .setParameter("path", path)
                .getResultList());
        ids.addAll(entityManager.createQuery(
                        "select c.booking.id from RentalContract c where c.paperContractUrl = :path and c.booking is not null", UUID.class)
                .setParameter("path", path)
                .getResultList());
        return ids;
    }

    public List<SupportTicket> findTicketsReferencing(String path) {
        return entityManager.createQuery(
                        "select t from SupportTicket t where t.imageEvidence like :pattern", SupportTicket.class)
                .setParameter("pattern", likePattern(path))
                .getResultList();
    }

    public List<RefundRequest> findRefundsReferencing(String path) {
        return entityManager.createQuery(
                        "select r from RefundRequest r where r.transferEvidenceUrl = :path", RefundRequest.class)
                .setParameter("path", path)
                .getResultList();
    }

    /** Contains-match pattern with the LIKE wildcards of the path escaped (PostgreSQL's default LIKE escape is a backslash). */
    private static String likePattern(String path) {
        return "%" + path.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    /** True while any record still points at the file (used before an orphan file is deleted). */
    public boolean isReferenced(String path) {
        return !findBookingIdsReferencingHandoverFile(path).isEmpty()
                || !findTicketsReferencing(path).isEmpty()
                || !findRefundsReferencing(path).isEmpty();
    }
}
