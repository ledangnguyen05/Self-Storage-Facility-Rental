package com.boxora.scheduler;

import com.boxora.entity.StoredFile;
import com.boxora.repository.StoredFileRepository;
import com.boxora.repository.UploadReferenceRepository;
import com.boxora.service.FileStorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Orphan uploads (a photo replaced in the wizard, an abandoned receipt) are cleaned up; anything a record points at stays. */
@ExtendWith(MockitoExtension.class)
class StoredFileCleanupSchedulerTest {

    @Mock private StoredFileRepository storedFileRepository;
    @Mock private UploadReferenceRepository uploadReferences;
    @Mock private FileStorageService fileStorageService;

    @InjectMocks
    private StoredFileCleanupScheduler scheduler;

    @TempDir
    Path dir;

    private StoredFile stored(String name) throws IOException {
        Path file = dir.resolve(name);
        Files.writeString(file, "x");
        StoredFile row = StoredFile.builder().urlPath("/uploads/handover/" + name).category("handover").build();
        lenient().when(fileStorageService.resolveStoredPath(row.getUrlPath())).thenReturn(file);
        return row;
    }

    @Test
    @DisplayName("Tệp không còn bản ghi nào tham chiếu bị xóa khỏi ổ đĩa và khỏi danh bạ")
    void unreferencedFileIsRemoved() throws IOException {
        StoredFile orphan = stored("orphan.jpg");
        LocalDateTime cutoff = LocalDateTime.now().minusDays(3);
        when(storedFileRepository.findByCategoryInAndCreatedAtBeforeOrderByCreatedAtAsc(any(), eq(cutoff), any(Pageable.class)))
                .thenReturn(List.of(orphan));
        when(uploadReferences.isReferenced(orphan.getUrlPath())).thenReturn(false);

        int removed = scheduler.purgeOrphans(cutoff);

        assertThat(removed).isEqualTo(1);
        assertThat(Files.exists(dir.resolve("orphan.jpg"))).isFalse();
        verify(storedFileRepository).delete(orphan);
    }

    @Test
    @DisplayName("Tệp vẫn được biên bản, khoản thu, phiếu hoặc yêu cầu hoàn tiền tham chiếu thì giữ nguyên")
    void referencedFileIsKept() throws IOException {
        StoredFile used = stored("used.jpg");
        LocalDateTime cutoff = LocalDateTime.now().minusDays(3);
        when(storedFileRepository.findByCategoryInAndCreatedAtBeforeOrderByCreatedAtAsc(any(), eq(cutoff), any(Pageable.class)))
                .thenReturn(List.of(used));
        when(uploadReferences.isReferenced(used.getUrlPath())).thenReturn(true);

        int removed = scheduler.purgeOrphans(cutoff);

        assertThat(removed).isZero();
        assertThat(Files.exists(dir.resolve("used.jpg"))).isTrue();
        verify(storedFileRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Chỉ các nhóm tệp đã biết cách đối chiếu (biên bản, phiếu, hoàn tiền) mới bị dọn")
    void onlyKnownCategoriesAreCleaned() {
        assertThat(StoredFileCleanupScheduler.CLEANED_CATEGORIES).containsExactlyInAnyOrder("handover", "tickets", "refunds");
    }
}
