package com.boxora.scheduler;

import com.boxora.entity.StoredFile;
import com.boxora.repository.StoredFileRepository;
import com.boxora.repository.UploadReferenceRepository;
import com.boxora.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Deletes uploaded files that no record ever used: a photo that was replaced in the check-in wizard, a receipt the staff
 * member abandoned. Only files older than the grace period are considered, only the categories whose references are
 * known (handover evidence, ticket photos, refund slips), and only when nothing references them.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class StoredFileCleanupScheduler {

    static final List<String> CLEANED_CATEGORIES = List.of("handover", "tickets", "refunds");
    private static final int BATCH_SIZE = 200;

    private final StoredFileRepository storedFileRepository;
    private final UploadReferenceRepository uploadReferences;
    private final FileStorageService fileStorageService;

    /** A file stays at least this long, so a wizard that is still open never loses its photos. */
    @Value("${app.upload.orphan-grace-hours:72}")
    private long graceHours;

    @Scheduled(cron = "${app.scheduling.upload-cleanup-cron:0 15 3 * * ?}")
    public void scheduledCleanup() {
        try {
            int removed = purgeOrphans(LocalDateTime.now().minusHours(Math.max(24, graceHours)));
            if (removed > 0) {
                log.info("Removed {} orphan uploaded files", removed);
            }
        } catch (Exception e) {
            log.error("Orphan upload clean-up failed: {}", e.getMessage(), e);
        }
    }

    /** Removes unreferenced files registered before {@code cutoff}; returns how many were deleted. */
    @Transactional
    public int purgeOrphans(LocalDateTime cutoff) {
        List<StoredFile> candidates = storedFileRepository
                .findByCategoryInAndCreatedAtBeforeOrderByCreatedAtAsc(CLEANED_CATEGORIES, cutoff, PageRequest.of(0, BATCH_SIZE));
        int removed = 0;
        for (StoredFile file : candidates) {
            if (uploadReferences.isReferenced(file.getUrlPath())) {
                continue;
            }
            Path onDisk = fileStorageService.resolveStoredPath(file.getUrlPath());
            try {
                if (onDisk != null) {
                    Files.deleteIfExists(onDisk);
                }
                storedFileRepository.delete(file);
                removed++;
            } catch (IOException e) {
                log.warn("Could not delete orphan upload {}: {}", file.getUrlPath(), e.getMessage());
            }
        }
        return removed;
    }
}
