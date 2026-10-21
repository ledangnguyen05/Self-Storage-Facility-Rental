package com.boxora.service;

import com.boxora.dto.response.SignedFileResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.RefundRequest;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.StoredFile;
import com.boxora.entity.SupportTicket;
import com.boxora.entity.User;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.StoredFileRepository;
import com.boxora.repository.UploadReferenceRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.FileStorageAccessService;
import com.boxora.service.impl.UploadUrlSigner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class FileStorageAccessServiceTest {

    private static final String HANDOVER = "/uploads/handover/11111111-1111-4111-8111-111111111111.jpg";
    private static final String TICKET = "/uploads/tickets/evidence-22222222-2222-4222-8222-222222222222.jpg";
    private static final String REFUND = "/uploads/refunds/33333333-3333-4333-8333-333333333333.png";

    @Mock private FileStorageService fileStorageService;
    @Mock private StoredFileRepository storedFileRepository;
    @Mock private UploadReferenceRepository uploadReferences;
    @Mock private BookingRepository bookingRepository;
    @Mock private RequestContext requestContext;

    private UploadUrlSigner signer;
    private FileStorageAccessService service;

    private Facility d1;
    private Facility d2;
    private User customer;
    private Booking booking;
    private UUID bookingId;

    @BeforeEach
    void setUp() {
        signer = new UploadUrlSigner("a-long-test-secret-for-signing", 900, Clock.systemUTC());
        service = new FileStorageAccessService(fileStorageService, storedFileRepository, uploadReferences,
                bookingRepository, requestContext, signer);

        d1 = Facility.builder().name("D1").build();
        d1.setId(UUID.randomUUID());
        d2 = Facility.builder().name("D2").build();
        d2.setId(UUID.randomUUID());
        customer = User.builder().fullName("Khách").build();
        customer.setId(UUID.randomUUID());
        StorageUnit unit = StorageUnit.builder().unitCode("D1-A101").facility(d1).build();
        unit.setId(UUID.randomUUID());
        booking = Booking.builder().customer(customer).storageUnit(unit).bookingCode("BX-1").build();
        bookingId = UUID.randomUUID();
        booking.setId(bookingId);

        lenient().when(fileStorageService.exists(any())).thenReturn(true);
        lenient().when(storedFileRepository.findByUrlPath(any())).thenReturn(Optional.empty());
        lenient().when(uploadReferences.findBookingIdsReferencingHandoverFile(any())).thenReturn(Set.of());
        lenient().when(uploadReferences.findTicketsReferencing(any())).thenReturn(List.of());
        lenient().when(uploadReferences.findRefundsReferencing(any())).thenReturn(List.of());
        lenient().when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
    }

    private void signedInAs(String role, UUID userId, UUID facilityId) {
        lenient().when(requestContext.currentUserId()).thenReturn(userId);
        lenient().when(requestContext.currentUserRole()).thenReturn(role);
        lenient().when(requestContext.currentUserFacilityId()).thenReturn(facilityId);
    }

    private void handoverFileOfBooking() {
        lenient().when(uploadReferences.findBookingIdsReferencingHandoverFile(HANDOVER)).thenReturn(Set.of(bookingId));
    }

    @Test
    @DisplayName("Nhân viên cơ sở của đơn nhận được link ký số; link đúng đường dẫn và kèm exp, sig")
    void staffOfTheBookingFacility_getsASignedLink() {
        handoverFileOfBooking();
        signedInAs("STAFF", UUID.randomUUID(), d1.getId());

        List<SignedFileResponse> result = service.sign(List.of(HANDOVER));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo("OK");
        assertThat(result.get(0).getSignedUrl()).startsWith(HANDOVER + "?exp=").contains("&sig=");
        assertThat(result.get(0).getExpiresAt()).isNotNull();
    }

    @Test
    @DisplayName("Nhân viên cơ sở khác không nhận được link (FORBIDDEN), không lộ đường dẫn ký")
    void staffOfAnotherFacility_isRefused() {
        handoverFileOfBooking();
        signedInAs("STAFF", UUID.randomUUID(), d2.getId());

        SignedFileResponse result = service.sign(List.of(HANDOVER)).get(0);

        assertThat(result.getStatus()).isEqualTo("FORBIDDEN");
        assertThat(result.getSignedUrl()).isNull();
    }

    @Test
    @DisplayName("Nhân viên chưa được gán cơ sở không xem được tệp của ai")
    void staffWithoutFacility_isRefused() {
        handoverFileOfBooking();
        signedInAs("STAFF", UUID.randomUUID(), null);

        assertThat(service.sign(List.of(HANDOVER)).get(0).getStatus()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("Khách chỉ xem tệp của đơn mình; khách khác bị từ chối")
    void customer_seesOnlyTheirOwnBookingFiles() {
        handoverFileOfBooking();
        signedInAs("CUSTOMER", customer.getId(), null);
        assertThat(service.sign(List.of(HANDOVER)).get(0).getStatus()).isEqualTo("OK");

        signedInAs("CUSTOMER", UUID.randomUUID(), null);
        assertThat(service.sign(List.of(HANDOVER)).get(0).getStatus()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("ADMIN và BUSINESS_MANAGER xem được mọi tệp tồn tại")
    void systemWideRoles_seeEveryFile() {
        signedInAs("ADMIN", UUID.randomUUID(), null);
        assertThat(service.sign(List.of(HANDOVER)).get(0).getStatus()).isEqualTo("OK");
        signedInAs("BUSINESS_MANAGER", UUID.randomUUID(), null);
        assertThat(service.sign(List.of(REFUND)).get(0).getStatus()).isEqualTo("OK");
    }

    @Test
    @DisplayName("Người tải lên xem được tệp vừa tải (chưa gắn vào biên bản nào)")
    void uploader_seesTheirFreshUpload() {
        UUID staffId = UUID.randomUUID();
        signedInAs("STAFF", staffId, d1.getId());
        StoredFile stored = StoredFile.builder().urlPath(HANDOVER).category("handover").uploadedById(staffId).build();
        lenient().when(storedFileRepository.findByUrlPath(HANDOVER)).thenReturn(Optional.of(stored));

        assertThat(service.sign(List.of(HANDOVER)).get(0).getStatus()).isEqualTo("OK");
    }

    @Test
    @DisplayName("Tệp chưa gắn biên bản: nhân viên cùng cơ sở xem được, nhân viên cơ sở khác và khách thì không")
    void unreferencedUpload_isVisibleToTheFacilityOnly() {
        StoredFile stored = StoredFile.builder().urlPath(HANDOVER).category("handover")
                .uploadedById(UUID.randomUUID()).facilityId(d1.getId()).build();
        lenient().when(storedFileRepository.findByUrlPath(HANDOVER)).thenReturn(Optional.of(stored));

        signedInAs("STAFF", UUID.randomUUID(), d1.getId());
        assertThat(service.sign(List.of(HANDOVER)).get(0).getStatus()).isEqualTo("OK");
        signedInAs("STAFF", UUID.randomUUID(), d2.getId());
        assertThat(service.sign(List.of(HANDOVER)).get(0).getStatus()).isEqualTo("FORBIDDEN");
        signedInAs("CUSTOMER", customer.getId(), null);
        assertThat(service.sign(List.of(HANDOVER)).get(0).getStatus()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("Ảnh sự cố: khách của phiếu và nhân viên cơ sở của phiếu xem được, người khác thì không")
    void ticketEvidence_followsTheTicket() {
        SupportTicket ticket = SupportTicket.builder().customer(customer).facility(d1).build();
        ticket.setId(UUID.randomUUID());
        lenient().when(uploadReferences.findTicketsReferencing(TICKET)).thenReturn(List.of(ticket));

        signedInAs("CUSTOMER", customer.getId(), null);
        assertThat(service.sign(List.of(TICKET)).get(0).getStatus()).isEqualTo("OK");
        signedInAs("FACILITY_MANAGER", UUID.randomUUID(), d1.getId());
        assertThat(service.sign(List.of(TICKET)).get(0).getStatus()).isEqualTo("OK");
        signedInAs("STAFF", UUID.randomUUID(), d2.getId());
        assertThat(service.sign(List.of(TICKET)).get(0).getStatus()).isEqualTo("FORBIDDEN");
        signedInAs("CUSTOMER", UUID.randomUUID(), null);
        assertThat(service.sign(List.of(TICKET)).get(0).getStatus()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("Biên lai chuyển khoản hoàn cọc: khách của yêu cầu và nhân viên cơ sở xem được")
    void refundSlip_followsTheRefund() {
        RefundRequest refund = RefundRequest.builder().customer(customer).facility(d1).build();
        refund.setId(UUID.randomUUID());
        lenient().when(uploadReferences.findRefundsReferencing(REFUND)).thenReturn(List.of(refund));

        signedInAs("CUSTOMER", customer.getId(), null);
        assertThat(service.sign(List.of(REFUND)).get(0).getStatus()).isEqualTo("OK");
        signedInAs("STAFF", UUID.randomUUID(), d1.getId());
        assertThat(service.sign(List.of(REFUND)).get(0).getStatus()).isEqualTo("OK");
        signedInAs("STAFF", UUID.randomUUID(), d2.getId());
        assertThat(service.sign(List.of(REFUND)).get(0).getStatus()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("Chưa đăng nhập -> không ký gì cả; tệp không tồn tại -> NOT_FOUND; đường dẫn lạ -> INVALID")
    void anonymousMissingAndInvalid() {
        signedInAs("STAFF", null, null);
        assertThat(service.sign(List.of(HANDOVER)).get(0).getStatus()).isEqualTo("FORBIDDEN");

        signedInAs("ADMIN", UUID.randomUUID(), null);
        lenient().when(fileStorageService.exists("/uploads/handover/gone.jpg")).thenReturn(false);
        assertThat(service.sign(List.of("/uploads/handover/gone.jpg")).get(0).getStatus()).isEqualTo("NOT_FOUND");
        assertThat(service.sign(List.of("http://evil.example/a.jpg")).get(0).getStatus()).isEqualTo("INVALID");
        assertThat(service.sign(List.of("/uploads/../etc/passwd")).get(0).getStatus()).isEqualTo("INVALID");
    }

    @Test
    @DisplayName("Link đã ký kèm query cũ vẫn được ký lại theo đường dẫn gốc, và các URL trùng chỉ ký một lần")
    void duplicatesAreSignedOnce_andOldQueriesAreIgnored() {
        signedInAs("ADMIN", UUID.randomUUID(), null);

        List<SignedFileResponse> result = service.sign(List.of(HANDOVER, HANDOVER, HANDOVER + "?exp=1&sig=old"));

        assertThat(result).hasSize(2);
        assertThat(result.get(1).getSignedUrl()).startsWith(HANDOVER + "?exp=").doesNotContain("sig=old");
    }
}
