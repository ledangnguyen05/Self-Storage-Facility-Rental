package com.boxora.service;

import com.boxora.dto.response.FileUploadResponse;
import com.boxora.entity.StoredFile;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.StoredFileRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.FileStorageServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Uploaded files are registered with their uploader / booking, and evidence is checked against that registry. */
class FileStorageRegistryTest {

    @TempDir
    Path uploadRoot;

    private Path root;
    private StoredFileRepository registry;
    private RequestContext requestContext;
    private FileStorageServiceImpl storage;

    private UUID staffId;
    private UUID facilityId;
    private UUID bookingId;

    @BeforeEach
    void setUp() {
        registry = mock(StoredFileRepository.class);
        requestContext = mock(RequestContext.class);
        staffId = UUID.randomUUID();
        facilityId = UUID.randomUUID();
        bookingId = UUID.randomUUID();
        when(requestContext.currentUserId()).thenReturn(staffId);
        when(requestContext.currentUserFacilityId()).thenReturn(facilityId);
        when(registry.save(any(StoredFile.class))).thenAnswer(inv -> inv.getArgument(0));
        root = uploadRoot.resolve("uploads");
        storage = new FileStorageServiceImpl(root.toString(), registry, requestContext);
    }

    private static MockMultipartFile jpeg() {
        byte[] data = new byte[64];
        data[0] = (byte) 0xFF;
        data[1] = (byte) 0xD8;
        data[2] = (byte) 0xFF;
        return new MockMultipartFile("file", "anh.jpg", "image/jpeg", data);
    }

    /** Stores a real file and makes the registry return the row that was saved for it. */
    private StoredFile storeAndRegister(String category, UUID forBooking, UUID forFacility, UUID uploader) {
        FileUploadResponse stored = storage.storeDocument(jpeg(), category, forBooking, forFacility);
        StoredFile row = StoredFile.builder().urlPath(stored.getFileUrl()).category(category)
                .bookingId(forBooking).facilityId(forFacility).uploadedById(uploader).build();
        when(registry.findByUrlPath(stored.getFileUrl())).thenReturn(Optional.of(row));
        return row;
    }

    @Test
    @DisplayName("Tệp tải lên được ghi vào sổ với người tải, cơ sở và đơn")
    void storeDocument_registersTheFile() {
        FileUploadResponse response = storage.storeDocument(jpeg(), "handover", bookingId, facilityId);

        ArgumentCaptor<StoredFile> saved = ArgumentCaptor.forClass(StoredFile.class);
        verify(registry).save(saved.capture());
        assertThat(saved.getValue().getUrlPath()).isEqualTo(response.getFileUrl());
        assertThat(saved.getValue().getCategory()).isEqualTo("handover");
        assertThat(saved.getValue().getUploadedById()).isEqualTo(staffId);
        assertThat(saved.getValue().getBookingId()).isEqualTo(bookingId);
        assertThat(saved.getValue().getFacilityId()).isEqualTo(facilityId);
        assertThat(saved.getValue().getOriginalName()).isEqualTo("anh.jpg");
    }

    @Test
    @DisplayName("Không truyền cơ sở thì dùng cơ sở của người tải (nhân viên)")
    void storeDocument_defaultsToTheUploadersFacility() {
        storage.storeDocument(jpeg(), "handover");

        ArgumentCaptor<StoredFile> saved = ArgumentCaptor.forClass(StoredFile.class);
        verify(registry).save(saved.capture());
        assertThat(saved.getValue().getFacilityId()).isEqualTo(facilityId);
        assertThat(saved.getValue().getBookingId()).isNull();
    }

    @Test
    @DisplayName("Minh chứng đơn: tệp thật của đúng đơn được chấp nhận")
    void bookingEvidence_acceptsAFileUploadedForTheBooking() {
        StoredFile row = storeAndRegister("handover", bookingId, facilityId, staffId);

        storage.requireBookingEvidence(List.of(row.getUrlPath()), bookingId, facilityId);

        verify(registry, never()).save(row);
    }

    @Test
    @DisplayName("Minh chứng đơn: đường dẫn bịa không có tệp -> HANDOVER_EVIDENCE_URL_INVALID")
    void bookingEvidence_rejectsMissingFiles() {
        for (String url : new String[]{"/uploads/handover/nonexistent-1.jpg", "/uploads/handover/00000000-0000-4000-8000-000000000000.jpg"}) {
            AppException ex = assertThrows(AppException.class,
                    () -> storage.requireBookingEvidence(List.of(url), bookingId, facilityId));
            assertThat(ex.getErrorCode()).as(url).isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
        }
    }

    @Test
    @DisplayName("Minh chứng đơn: tệp có trên đĩa nhưng không qua API tải lên (không có trong sổ) bị từ chối")
    void bookingEvidence_rejectsUnregisteredFiles() throws Exception {
        Path dir = Files.createDirectories(root.resolve("handover"));
        Files.write(dir.resolve("planted.jpg"), new byte[]{1, 2, 3});
        when(registry.findByUrlPath("/uploads/handover/planted.jpg")).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class,
                () -> storage.requireBookingEvidence(List.of("/uploads/handover/planted.jpg"), bookingId, facilityId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
    }

    @Test
    @DisplayName("Minh chứng đơn: tệp đã tải cho đơn khác hoặc cơ sở khác bị từ chối")
    void bookingEvidence_rejectsAFileOfAnotherBookingOrFacility() {
        StoredFile otherBooking = storeAndRegister("handover", UUID.randomUUID(), facilityId, staffId);
        AppException ex = assertThrows(AppException.class,
                () -> storage.requireBookingEvidence(List.of(otherBooking.getUrlPath()), bookingId, facilityId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);

        StoredFile otherFacility = storeAndRegister("handover", null, UUID.randomUUID(), UUID.randomUUID());
        AppException ex2 = assertThrows(AppException.class,
                () -> storage.requireBookingEvidence(List.of(otherFacility.getUrlPath()), bookingId, facilityId));
        assertThat(ex2.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
    }

    @Test
    @DisplayName("Minh chứng đơn: tệp chưa gắn đơn được gắn vào đơn ở lần dùng đầu và không dùng lại cho đơn khác")
    void bookingEvidence_bindsTheFileOnFirstUse() {
        StoredFile row = storeAndRegister("handover", null, facilityId, staffId);

        storage.requireBookingEvidence(List.of(row.getUrlPath()), bookingId, facilityId);
        assertThat(row.getBookingId()).isEqualTo(bookingId);
        verify(registry).save(row);

        AppException ex = assertThrows(AppException.class,
                () -> storage.requireBookingEvidence(List.of(row.getUrlPath()), UUID.randomUUID(), facilityId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
    }

    @Test
    @DisplayName("Minh chứng phiếu: chỉ nhận tệp trong thư mục tickets do chính người gửi tải lên")
    void ticketEvidence_mustBeOwnUploads() {
        StoredFile mine = storeAndRegister("tickets", null, facilityId, staffId);
        storage.requireOwnUploads(List.of(mine.getUrlPath()), "tickets");

        StoredFile theirs = storeAndRegister("tickets", null, facilityId, UUID.randomUUID());
        AppException notMine = assertThrows(AppException.class,
                () -> storage.requireOwnUploads(List.of(theirs.getUrlPath()), "tickets"));
        assertThat(notMine.getErrorCode()).isEqualTo(ErrorCode.TICKET_EVIDENCE_INVALID);

        StoredFile wrongFolder = storeAndRegister("handover", null, facilityId, staffId);
        AppException folder = assertThrows(AppException.class,
                () -> storage.requireOwnUploads(List.of(wrongFolder.getUrlPath()), "tickets"));
        assertThat(folder.getErrorCode()).isEqualTo(ErrorCode.TICKET_EVIDENCE_INVALID);

        AppException missing = assertThrows(AppException.class,
                () -> storage.requireOwnUploads(List.of("/uploads/tickets/evidence-missing.jpg"), "tickets"));
        assertThat(missing.getErrorCode()).isEqualTo(ErrorCode.TICKET_EVIDENCE_INVALID);
    }

    @Test
    @DisplayName("resolveStoredPath chỉ trả về tệp nằm trong thư mục gốc; đường dẫn thoát thư mục -> null")
    void resolveStoredPath_staysInsideTheUploadRoot() throws Exception {
        Path dir = Files.createDirectories(root.resolve("handover"));
        Files.write(dir.resolve("ok.jpg"), new byte[]{1});
        Files.write(uploadRoot.resolve("outside.txt"), new byte[]{1});

        assertThat(storage.resolveStoredPath("/uploads/handover/ok.jpg")).isEqualTo(dir.resolve("ok.jpg").toAbsolutePath().normalize());
        assertThat(storage.resolveStoredPath("/uploads/handover/missing.jpg")).isNull();
        assertThat(storage.resolveStoredPath("/uploads/../outside.txt")).isNull();
        assertThat(storage.resolveStoredPath("/uploads/handover/../../outside.txt")).isNull();
        assertThat(storage.resolveStoredPath("/uploads/handover")).isNull();
        assertThat(storage.resolveStoredPath(null)).isNull();
    }
}
