package com.boxora.service;

import com.boxora.dto.request.SupportTicketContactLogRequest;
import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.request.TicketAssignRequest;
import com.boxora.dto.request.TicketReopenRequest;
import com.boxora.dto.request.TicketStatusUpdateRequest;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.SupportTicketContactLogResponse;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.dto.response.SupportTicketStatsResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.Role;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.SupportTicket;
import com.boxora.entity.SupportTicketContactLog;
import com.boxora.entity.User;
import com.boxora.enums.TicketCategory;
import com.boxora.enums.TicketStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.ActivityLogRepository;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.SupportTicketContactLogRepository;
import com.boxora.repository.SupportTicketRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.impl.SupportTicketServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupportTicketServiceTest {

    @Mock
    private SupportTicketRepository supportTicketRepository;

    @Mock
    private SupportTicketContactLogRepository contactLogRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private ActivityLogRepository activityLogRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private com.boxora.repository.NotificationLogRepository notificationLogRepository;

    @Mock
    private com.boxora.security.RequestContext requestContext;

    @InjectMocks
    private SupportTicketServiceImpl supportTicketService;

    private User testCustomer;
    private Booking testBooking;
    private StorageUnit testUnit;
    private Facility testFacility;
    private UUID customerId;
    private UUID bookingId;
    private UUID facilityId;

    @BeforeEach
    void setUp() {
        customerId = UUID.randomUUID();
        bookingId = UUID.randomUUID();
        facilityId = UUID.randomUUID();

        testFacility = Facility.builder()
                .name("Boxora District 1")
                .code("BX-D1")
                .build();
        testFacility.setId(facilityId);

        testCustomer = User.builder()
                .fullName("Lê Đăng Nguyên")
                .phone("0912345678")
                .facility(testFacility)
                .build();
        testCustomer.setId(customerId);

        testUnit = StorageUnit.builder()
                .unitCode("A-108")
                .facility(testFacility)
                .build();
        testUnit.setId(UUID.randomUUID());

        testBooking = Booking.builder()
                .customer(testCustomer)
                .storageUnit(testUnit)
                .build();
        testBooking.setId(bookingId);

        lenient().when(requestContext.currentUserId()).thenReturn(customerId);
        lenient().when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
    }

    @Nested
    @DisplayName("Create Ticket Tests with Evidence URLs")
    class CreateTicketTests {

        @Test
        @DisplayName("createTicket should save imageEvidence string and parse into evidenceUrls response")
        void createTicket_withSingleImageEvidence_shouldSucceed() {
            String testImageUrl = "/uploads/tickets/evidence-3f6c1b2e-0a11-4c3d-9d0f-1a2b3c4d5e6f.jpg";
            SupportTicketRequest request = SupportTicketRequest.builder()
                    .customerId(customerId)
                    .bookingId(bookingId)
                    .category("LOCK_ISSUE")
                    .title("Kẹt khóa thông minh")
                    .description("Khóa cửa không nhận mã PIN")
                    .priority("HIGH")
                    .imageEvidence(testImageUrl)
                    .build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> {
                SupportTicket t = invocation.getArgument(0);
                t.setId(UUID.randomUUID());
                return t;
            });

            SupportTicketResponse response = supportTicketService.createTicket(request);

            assertThat(response).isNotNull();
            assertThat(response.getTitle()).isEqualTo("Kẹt khóa thông minh");
            assertThat(response.getCategory()).isEqualTo("LOCK_ISSUE");
            assertThat(response.getImageEvidence()).isEqualTo(testImageUrl);
            assertThat(response.getEvidenceUrls()).containsExactly(testImageUrl);
            assertThat(response.getCustomerName()).isEqualTo("Lê Đăng Nguyên");
            assertThat(response.getUnitCode()).isEqualTo("A-108");
            assertThat(response.getFacilityName()).isEqualTo("Boxora District 1");
        }

        @Test
        @DisplayName("createTicket with list of evidenceUrls should join with semicolon and return in evidenceUrls")
        void createTicket_withMultipleEvidenceUrls_shouldCombineCorrectly() {
            List<String> urls = List.of(
                    "/uploads/tickets/evidence-1.jpg",
                    "/uploads/tickets/evidence-2.jpg",
                    "/uploads/tickets/evidence-3.jpg"
            );
            SupportTicketRequest request = SupportTicketRequest.builder()
                    .customerId(customerId)
                    .bookingId(bookingId)
                    .category("FACILITY_DAMAGE")
                    .title("Vết nứt trên vách ngăn")
                    .description("Chi tiết")
                    .priority("MEDIUM")
                    .evidenceUrls(urls)
                    .build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> {
                SupportTicket t = invocation.getArgument(0);
                t.setId(UUID.randomUUID());
                return t;
            });

            SupportTicketResponse response = supportTicketService.createTicket(request);

            assertThat(response).isNotNull();
            assertThat(response.getImageEvidence()).isEqualTo("/uploads/tickets/evidence-1.jpg;/uploads/tickets/evidence-2.jpg;/uploads/tickets/evidence-3.jpg");
            assertThat(response.getEvidenceUrls()).containsExactlyElementsOf(urls);
        }

        @Test
        @DisplayName("createTicket without evidence should return empty list for evidenceUrls")
        void createTicket_withoutEvidence_shouldReturnEmptyList() {
            SupportTicketRequest request = SupportTicketRequest.builder()
                    .customerId(customerId)
                    .bookingId(bookingId)
                    .category("OTHER")
                    .title("Yêu cầu xe kéo")
                    .description("Cần xe kéo hàng")
                    .priority("LOW")
                    .build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> {
                SupportTicket t = invocation.getArgument(0);
                t.setId(UUID.randomUUID());
                return t;
            });

            SupportTicketResponse response = supportTicketService.createTicket(request);

            assertThat(response).isNotNull();
            assertThat(response.getImageEvidence()).isNull();
            assertThat(response.getEvidenceUrls()).isEmpty();
        }

        @Test
        @DisplayName("createTicketWithFiles should upload files and delegate to createTicket")
        void createTicketWithFiles_shouldUploadAndCreateTicket() {
            MockMultipartFile file1 = new MockMultipartFile("files", "img1.png", "image/png", "abc".getBytes());
            MockMultipartFile file2 = new MockMultipartFile("files", "img2.jpg", "image/jpeg", "def".getBytes());
            List<MultipartFile> files = List.of(file1, file2);

            when(fileStorageService.storeFiles(files, "tickets")).thenReturn(List.of(
                    FileUploadResponse.builder().fileUrl("/uploads/tickets/evidence-aaa.png").fileName("img1.png").build(),
                    FileUploadResponse.builder().fileUrl("/uploads/tickets/evidence-bbb.jpg").fileName("img2.jpg").build()
            ));

            SupportTicketRequest request = SupportTicketRequest.builder()
                    .customerId(customerId)
                    .bookingId(bookingId)
                    .category("LOCK_ISSUE")
                    .title("Lỗi khóa vân tay")
                    .description("Kèm 2 file ảnh")
                    .priority("URGENT")
                    .build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> {
                SupportTicket t = invocation.getArgument(0);
                t.setId(UUID.randomUUID());
                return t;
            });

            SupportTicketResponse response = supportTicketService.createTicketWithFiles(request, files);

            assertThat(response).isNotNull();
            assertThat(response.getEvidenceUrls()).containsExactly("/uploads/tickets/evidence-aaa.png", "/uploads/tickets/evidence-bbb.jpg");
            verify(fileStorageService).storeFiles(files, "tickets");
        }
    }

    @Nested
    @DisplayName("Mandatory 10 Integration Scenarios for Role Permissions")
    class RolePermissionTests {

        // Scenario 1: Customer A cannot view or edit Customer B's tickets
        @Test
        @DisplayName("Scenario 1: Customer A cannot view Customer B tickets (throws FORBIDDEN)")
        void scenario1_customerCannotViewOtherCustomerTickets() {
            UUID customerBId = UUID.randomUUID();
            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.getMyTickets(customerBId));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        // Scenario 2: Facility Staff cannot assign tickets if they don't have permission
        @Test
        @DisplayName("Scenario 2: Facility Staff cannot assign ticket to another staff (throws FORBIDDEN)")
        void scenario2_staffCannotAssignTicket() {
            UUID ticketId = UUID.randomUUID();
            UUID otherStaffId = UUID.randomUUID();
            when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());
            when(requestContext.currentUserRole()).thenReturn("STAFF");

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.assignTicket(ticketId, otherStaffId));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        // Scenario 3: Facility Staff cannot access tickets outside assigned facility
        @Test
        @DisplayName("Scenario 3: Facility Staff cannot resolve ticket of another facility (throws FORBIDDEN)")
        void scenario3_staffCannotAccessForeignFacilityTicket() {
            UUID staffId = UUID.randomUUID();
            UUID foreignFacilityId = UUID.randomUUID();
            Facility foreignFacility = Facility.builder().name("Foreign").build();
            foreignFacility.setId(foreignFacilityId);

            User staff = User.builder().fullName("Staff D1").facility(testFacility).build();
            staff.setId(staffId);

            SupportTicket ticket = SupportTicket.builder()
                    .title("Foreign ticket")
                    .facility(foreignFacility)
                    .status(TicketStatus.OPEN)
                    .build();
            UUID ticketId = UUID.randomUUID();
            ticket.setId(ticketId);

            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");
            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.resolveTicket(ticketId, "Done"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_FACILITY_MISMATCH);
        }

        // Scenario 4: Facility Manager can manage in their facility, but not another
        @Test
        @DisplayName("Scenario 4: Facility Manager managing foreign facility ticket throws FORBIDDEN")
        void scenario4_managerCannotManageForeignFacility() {
            UUID managerId = UUID.randomUUID();
            UUID foreignFacilityId = UUID.randomUUID();
            Facility foreignFacility = Facility.builder().name("Foreign").build();
            foreignFacility.setId(foreignFacilityId);

            User manager = User.builder().fullName("Manager D1").facility(testFacility).build();
            manager.setId(managerId);

            SupportTicket foreignTicket = SupportTicket.builder()
                    .title("Foreign ticket")
                    .facility(foreignFacility)
                    .status(TicketStatus.OPEN)
                    .build();
            UUID ticketId = UUID.randomUUID();
            foreignTicket.setId(ticketId);

            when(requestContext.currentUserId()).thenReturn(managerId);
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(foreignTicket));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.assignTicket(ticketId, UUID.randomUUID()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_FACILITY_MISMATCH);
        }

        // Scenario 5: Business Operations Manager can view reports, rejected on write
        @Test
        @DisplayName("Scenario 5: BOM cannot create, assign, or resolve tickets (throws FORBIDDEN)")
        void scenario5_bomCannotMutateTickets() {
            UUID bomId = UUID.randomUUID();
            when(requestContext.currentUserId()).thenReturn(bomId);
            when(requestContext.currentUserRole()).thenReturn("BUSINESS_MANAGER");

            SupportTicketRequest createReq = SupportTicketRequest.builder().title("BOM create").build();
            AppException ex1 = assertThrows(AppException.class, () -> supportTicketService.createTicket(createReq));
            assertThat(ex1.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);

            AppException ex2 = assertThrows(AppException.class, () -> supportTicketService.resolveTicket(UUID.randomUUID(), "Note"));
            assertThat(ex2.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);

            AppException ex3 = assertThrows(AppException.class, () -> supportTicketService.assignTicket(UUID.randomUUID(), UUID.randomUUID()));
            assertThat(ex3.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        // Scenario 6: System Administrator can view audit/reports, rejected on business mutation
        @Test
        @DisplayName("Scenario 6: System Admin cannot directly resolve or close tickets (throws FORBIDDEN)")
        void scenario6_adminCannotMutateTickets() {
            UUID adminId = UUID.randomUUID();
            when(requestContext.currentUserId()).thenReturn(adminId);
            when(requestContext.currentUserRole()).thenReturn("ADMIN");

            AppException ex1 = assertThrows(AppException.class, () -> supportTicketService.resolveTicket(UUID.randomUUID(), "Admin resolve"));
            assertThat(ex1.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);

            AppException ex2 = assertThrows(AppException.class, () -> supportTicketService.closeTicket(UUID.randomUUID(), "Admin close"));
            assertThat(ex2.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        // Scenario 7: Facility Manager can record contact log with Business Operations Manager
        @Test
        @DisplayName("Scenario 7: Facility Manager records contact log with BOM successfully")
        void scenario7_managerCanRecordContactLog() {
            UUID managerId = UUID.randomUUID();
            User manager = User.builder().fullName("Manager Tri").facility(testFacility).build();
            manager.setId(managerId);

            SupportTicket ticket = SupportTicket.builder()
                    .title("Sự cố phức tạp")
                    .facility(testFacility)
                    .status(TicketStatus.IN_PROGRESS)
                    .build();
            UUID ticketId = UUID.randomUUID();
            ticket.setId(ticketId);

            SupportTicketContactLogRequest logReq = SupportTicketContactLogRequest.builder()
                    .contactMethod("PHONE")
                    .contactTarget("0371234569 - BOM Long")
                    .summary("Xin ý kiến đền bù hư hại tài sản ngoài hợp đồng")
                    .result("BOM đồng ý hỗ trợ tối đa 5.000.000đ")
                    .build();

            when(requestContext.currentUserId()).thenReturn(managerId);
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(contactLogRepository.save(any(SupportTicketContactLog.class))).thenAnswer(inv -> {
                SupportTicketContactLog l = inv.getArgument(0);
                l.setId(UUID.randomUUID());
                return l;
            });

            SupportTicketContactLogResponse res = supportTicketService.recordContactLog(ticketId, logReq);

            assertThat(res).isNotNull();
            assertThat(res.getContactMethod()).isEqualTo("PHONE");
            assertThat(res.getSummary()).contains("Xin ý kiến đền bù");
            assertThat(res.getContactedByName()).isEqualTo("Manager Tri");
            verify(contactLogRepository).save(any());
        }

        // Scenario 8: Contact log does not change ticket status
        @Test
        @DisplayName("Scenario 8: Recording contact log preserves ticket status")
        void scenario8_contactLogDoesNotAlterTicketStatus() {
            UUID managerId = UUID.randomUUID();
            User manager = User.builder().fullName("Manager Tri").facility(testFacility).build();
            manager.setId(managerId);

            SupportTicket ticket = SupportTicket.builder()
                    .title("Sự cố")
                    .facility(testFacility)
                    .status(TicketStatus.IN_PROGRESS)
                    .build();
            UUID ticketId = UUID.randomUUID();
            ticket.setId(ticketId);

            SupportTicketContactLogRequest logReq = SupportTicketContactLogRequest.builder()
                    .contactMethod("EMAIL")
                    .contactTarget("business1@gmail.com")
                    .summary("Báo cáo khẩn")
                    .build();

            when(requestContext.currentUserId()).thenReturn(managerId);
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(contactLogRepository.save(any(SupportTicketContactLog.class))).thenAnswer(inv -> {
                SupportTicketContactLog l = inv.getArgument(0);
                l.setId(UUID.randomUUID());
                return l;
            });

            supportTicketService.recordContactLog(ticketId, logReq);

            assertThat(ticket.getStatus()).isEqualTo(TicketStatus.IN_PROGRESS);
            verify(supportTicketRepository, never()).save(any());
        }

        // Scenario 9: Invalid state transitions rejected
        @Test
        @DisplayName("Scenario 9: Closing an OPEN ticket directly is rejected with TICKET_INVALID_STATUS_TRANSITION")
        void scenario9_invalidStatusTransitionRejected() {
            SupportTicket ticket = SupportTicket.builder()
                    .title("Ticket mới tạo")
                    .customer(testCustomer)
                    .facility(testFacility)
                    .status(TicketStatus.OPEN)
                    .build();
            UUID ticketId = UUID.randomUUID();
            ticket.setId(ticketId);

            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.closeTicket(ticketId, "Confirm"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_INVALID_STATUS_TRANSITION);
        }

        // Scenario 10: Full flow test (Create -> Take -> Resolve -> Confirm/Close -> Reopen)
        @Test
        @DisplayName("Scenario 10: Complete lifecycle: Staff resolves -> Customer confirms -> Customer reopens")
        void scenario10_completeTicketLifecycle() {
            UUID staffId = UUID.randomUUID();
            User staff = User.builder().fullName("Staff An").facility(testFacility).build();
            staff.setId(staffId);

            SupportTicket ticket = SupportTicket.builder()
                    .title("Lỗi khóa cửa")
                    .customer(testCustomer)
                    .facility(testFacility)
                    .assignedStaff(staff)
                    .status(TicketStatus.IN_PROGRESS)
                    .build();
            UUID ticketId = UUID.randomUUID();
            ticket.setId(ticketId);

            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));

            // Step 1: Staff resolves ticket
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));

            SupportTicketResponse resolvedRes = supportTicketService.resolveTicket(ticketId, "Đã tra dầu ổ khóa");
            assertThat(resolvedRes.getStatus()).isEqualTo("RESOLVED");

            // Step 2: Customer reopens ticket
            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");

            SupportTicketResponse reopenedRes = supportTicketService.reopenTicket(ticketId, "Vẫn kêu cót két khi mở");
            assertThat(reopenedRes.getStatus()).isEqualTo("REOPENED");
            // The reason is its own field now, not glued into the resolution note.
            assertThat(reopenedRes.getReopenReason()).isEqualTo("Vẫn kêu cót két khi mở");
            assertThat(reopenedRes.getReopenCount()).isEqualTo(1);
            assertThat(ticket.getResolutionNote()).doesNotContain("REOPEN").doesNotContain("null");

            // Step 3: Staff takes the reopened ticket again, then resolves it
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");
            supportTicketService.takeOwnership(ticketId);
            assertThat(ticket.getStatus()).isEqualTo(TicketStatus.IN_PROGRESS);
            supportTicketService.resolveTicket(ticketId, "Đã thay mới linh kiện");
            assertThat(ticket.getStatus()).isEqualTo(TicketStatus.RESOLVED);

            // Step 4: Customer confirms and closes ticket
            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            SupportTicketResponse closedRes = supportTicketService.closeTicket(ticketId, "Hài lòng, đóng phiếu");
            assertThat(closedRes.getStatus()).isEqualTo("CLOSED");
        }
    }

    @Nested
    @DisplayName("Task 2: Close Ticket Tests (Xác nhận hài lòng & Đóng phiếu)")
    class Task2CloseTicketTests {

        @Test
        @DisplayName("Customer closes own resolved ticket successfully")
        void customerClosesOwnResolvedTicket_success() {
            UUID ticketId = UUID.randomUUID();
            SupportTicket ticket = SupportTicket.builder()
                    .title("Hỏng đèn chiếu sáng")
                    .customer(testCustomer)
                    .facility(testFacility)
                    .status(TicketStatus.RESOLVED)
                    .resolutionNote("Đã thay bóng đèn led mới")
                    .build();
            ticket.setId(ticketId);

            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));

            SupportTicketResponse res = supportTicketService.closeTicket(ticketId, "Khách hàng rất hài lòng");

            assertThat(res).isNotNull();
            assertThat(res.getStatus()).isEqualTo("CLOSED");
            assertThat(ticket.getStatus()).isEqualTo(TicketStatus.CLOSED);
            assertThat(ticket.getClosedAt()).isNotNull();
            assertThat(ticket.getResolutionNote()).contains("Đóng phiếu: Khách hàng rất hài lòng");
        }

        @Test
        @DisplayName("Customer cannot close ticket if status is OPEN or IN_PROGRESS")
        void customerCannotCloseNonResolvedTicket_throwsException() {
            UUID ticketId = UUID.randomUUID();
            SupportTicket ticket = SupportTicket.builder()
                    .title("Hỏng khóa")
                    .customer(testCustomer)
                    .facility(testFacility)
                    .status(TicketStatus.IN_PROGRESS)
                    .build();
            ticket.setId(ticketId);

            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.closeTicket(ticketId, "Đóng sớm"));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_INVALID_STATUS_TRANSITION);
            assertThat(ticket.getStatus()).isEqualTo(TicketStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("Customer cannot close ticket of another customer")
        void customerCannotCloseOtherCustomerTicket_throwsForbidden() {
            UUID ticketId = UUID.randomUUID();
            User otherCustomer = User.builder().fullName("Người khác").build();
            otherCustomer.setId(UUID.randomUUID());

            SupportTicket ticket = SupportTicket.builder()
                    .title("Sự cố người khác")
                    .customer(otherCustomer)
                    .facility(testFacility)
                    .status(TicketStatus.RESOLVED)
                    .build();
            ticket.setId(ticketId);

            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.closeTicket(ticketId, "Can thiệp ticket người khác"));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("Staff cannot directly close ticket (throws FORBIDDEN)")
        void staffCannotDirectlyCloseTicket_throwsForbidden() {
            UUID staffId = UUID.randomUUID();
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.closeTicket(UUID.randomUUID(), "Staff tự đóng"));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("Cannot close ticket that is already CLOSED")
        void alreadyClosedTicketCannotBeClosedAgain_throwsException() {
            UUID ticketId = UUID.randomUUID();
            SupportTicket ticket = SupportTicket.builder()
                    .title("Sự cố đã đóng")
                    .customer(testCustomer)
                    .facility(testFacility)
                    .status(TicketStatus.CLOSED)
                    .build();
            ticket.setId(ticketId);

            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.closeTicket(ticketId, "Đóng lần hai"));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_INVALID_STATUS_TRANSITION);
        }
    }

    @Nested
    @DisplayName("Task 3: Facility Filter Scoping Tests (Phân quyền lọc cơ sở)")
    class Task3FacilityFilterScopingTests {

        @Test
        @DisplayName("Staff queries queue without facilityId -> returns tickets strictly for assigned facility")
        void staffQueriesQueueWithoutFacilityId_returnsScopedTickets() {
            UUID staffId = UUID.randomUUID();
            User staff = User.builder().fullName("Staff Bao").facility(testFacility).build();
            staff.setId(staffId);

            SupportTicket ticket1 = SupportTicket.builder()
                    .title("Sự cố 1")
                    .facility(testFacility)
                    .status(TicketStatus.OPEN)
                    .build();

            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
            when(supportTicketRepository.findByFacility_IdOrAssignedStaff_Id(facilityId, staffId))
                    .thenReturn(List.of(ticket1));

            List<SupportTicketResponse> res = supportTicketService.getQueue(null, null, null, null);

            assertThat(res).hasSize(1);
            assertThat(res.get(0).getTitle()).isEqualTo("Sự cố 1");
            verify(supportTicketRepository).findByFacility_IdOrAssignedStaff_Id(facilityId, staffId);
        }

        @Test
        @DisplayName("Staff queries queue with another facilityId -> throws FORBIDDEN")
        void staffQueriesQueueWithOtherFacilityId_throwsForbidden() {
            UUID staffId = UUID.randomUUID();
            User staff = User.builder().fullName("Staff Bao").facility(testFacility).build();
            staff.setId(staffId);
            UUID otherFacilityId = UUID.randomUUID();

            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.getQueue(otherFacilityId, null, null, null));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("Facility Manager queries queue without facilityId -> returns tickets for their facility")
        void managerQueriesQueueWithoutFacilityId_returnsScopedTickets() {
            UUID managerId = UUID.randomUUID();
            User manager = User.builder().fullName("Manager Chi").facility(testFacility).build();
            manager.setId(managerId);

            SupportTicket ticket1 = SupportTicket.builder()
                    .title("Sự cố cơ sở 1")
                    .facility(testFacility)
                    .status(TicketStatus.OPEN)
                    .build();

            when(requestContext.currentUserId()).thenReturn(managerId);
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(supportTicketRepository.findByFacility_Id(facilityId))
                    .thenReturn(List.of(ticket1));

            List<SupportTicketResponse> res = supportTicketService.getQueue(null, null, null, null);

            assertThat(res).hasSize(1);
            verify(supportTicketRepository).findByFacility_Id(facilityId);
        }

        @Test
        @DisplayName("Facility Manager queries queue with another facilityId -> throws FORBIDDEN")
        void managerQueriesQueueWithOtherFacilityId_throwsForbidden() {
            UUID managerId = UUID.randomUUID();
            User manager = User.builder().fullName("Manager Chi").facility(testFacility).build();
            manager.setId(managerId);
            UUID otherFacilityId = UUID.randomUUID();

            when(requestContext.currentUserId()).thenReturn(managerId);
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.getQueue(otherFacilityId, null, null, null));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("Admin queries queue with null facilityId -> returns system-wide tickets (Tất cả cơ sở)")
        void adminQueriesQueueWithNullFacilityId_returnsAllTickets() {
            UUID adminId = UUID.randomUUID();
            User admin = User.builder().fullName("Admin Sys").build();
            admin.setId(adminId);

            SupportTicket ticket1 = SupportTicket.builder().title("Ticket 1").facility(testFacility).status(TicketStatus.OPEN).build();
            Facility otherFacility = Facility.builder().name("Boxora Q2").build();
            otherFacility.setId(UUID.randomUUID());
            SupportTicket ticket2 = SupportTicket.builder().title("Ticket 2").facility(otherFacility).status(TicketStatus.OPEN).build();

            when(requestContext.currentUserId()).thenReturn(adminId);
            when(requestContext.currentUserRole()).thenReturn("ADMIN");
            when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
            when(supportTicketRepository.findAll()).thenReturn(List.of(ticket1, ticket2));

            List<SupportTicketResponse> res = supportTicketService.getQueue(null, null, null, null);

            assertThat(res).hasSize(2);
            verify(supportTicketRepository).findAll();
        }

        @Test
        @DisplayName("Admin queries queue with specific facilityId -> returns tickets for that facility")
        void adminQueriesQueueWithSpecificFacilityId_returnsFilteredTickets() {
            UUID adminId = UUID.randomUUID();
            User admin = User.builder().fullName("Admin Sys").build();
            admin.setId(adminId);

            SupportTicket ticket1 = SupportTicket.builder().title("Ticket 1").facility(testFacility).status(TicketStatus.OPEN).build();

            when(requestContext.currentUserId()).thenReturn(adminId);
            when(requestContext.currentUserRole()).thenReturn("ADMIN");
            when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
            when(supportTicketRepository.findByFacility_Id(facilityId)).thenReturn(List.of(ticket1));

            List<SupportTicketResponse> res = supportTicketService.getQueue(facilityId, null, null, null);

            assertThat(res).hasSize(1);
            verify(supportTicketRepository).findByFacility_Id(facilityId);
        }

        @Test
        @DisplayName("Unauthenticated request to getQueue -> throws UNAUTHORIZED")
        void unauthenticatedRequestToGetQueue_throwsUnauthorized() {
            when(requestContext.currentUserId()).thenReturn(null);

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.getQueue(null, null, null, null));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED);
        }

        @Test
        @DisplayName("Staff queries stats with another facilityId -> throws FORBIDDEN")
        void staffQueriesStatsWithOtherFacilityId_throwsForbidden() {
            UUID staffId = UUID.randomUUID();
            User staff = User.builder().fullName("Staff Bao").facility(testFacility).build();
            staff.setId(staffId);
            UUID otherFacilityId = UUID.randomUUID();

            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.getStats(otherFacilityId));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }
    }

    @Nested
    @DisplayName("Task 4: dữ liệu thật cho phiếu sự cố (phân công, mở lại, thống kê, định tuyến)")
    class Task4TicketDataTests {

        private SupportTicket openTicket() {
            SupportTicket ticket = SupportTicket.builder()
                    .title("Kẹt cửa cuốn")
                    .customer(testCustomer)
                    .facility(testFacility)
                    .status(TicketStatus.OPEN)
                    .priority("MEDIUM")
                    .build();
            ticket.setId(UUID.randomUUID());
            ticket.setCreatedAt(LocalDateTime.now().minusHours(1));
            ticket.setSlaDueAt(ticket.getCreatedAt().plusHours(24));
            return ticket;
        }

        @Test
        @DisplayName("Phân công áp dụng mức ưu tiên mới, tính lại SLA và ghi chỉ đạo của quản lý")
        void assign_appliesPriorityAndNotes() {
            UUID managerId = UUID.randomUUID();
            UUID staffId = UUID.randomUUID();
            User manager = User.builder().fullName("Quản lý Trí").facility(testFacility).build();
            manager.setId(managerId);
            User staff = User.builder().fullName("Nhân viên An").facility(testFacility)
                    .role(Role.builder().name("STAFF").build()).build();
            staff.setId(staffId);
            SupportTicket ticket = openTicket();

            when(requestContext.currentUserId()).thenReturn(managerId);
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(supportTicketRepository.findById(ticket.getId())).thenReturn(Optional.of(ticket));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));

            SupportTicketResponse res = supportTicketService.assignTicket(ticket.getId(),
                    TicketAssignRequest.builder().staffId(staffId).priority("urgent").notes("Kiểm tra nguồn khóa trước 10h").build());

            assertThat(res.getPriority()).isEqualTo("URGENT");
            assertThat(res.getStatus()).isEqualTo("IN_PROGRESS");
            assertThat(res.getAssignedStaffId()).isEqualTo(staffId);
            // URGENT = 2h counted from the creation time (one hour ago), not the old 24h window.
            assertThat(ticket.getSlaDueAt()).isEqualTo(ticket.getCreatedAt().plusHours(2));
            assertThat(res.getResolutionNote()).contains("Chỉ đạo phân công: Kiểm tra nguồn khóa trước 10h");
        }

        @Test
        @DisplayName("Phân công với mức ưu tiên không hợp lệ -> TICKET_INVALID_PRIORITY, không đổi phiếu")
        void assign_rejectsUnknownPriority() {
            UUID managerId = UUID.randomUUID();
            UUID staffId = UUID.randomUUID();
            User manager = User.builder().fullName("Quản lý Trí").facility(testFacility).build();
            manager.setId(managerId);
            User staff = User.builder().fullName("Nhân viên An").facility(testFacility)
                    .role(Role.builder().name("STAFF").build()).build();
            staff.setId(staffId);
            SupportTicket ticket = openTicket();

            when(requestContext.currentUserId()).thenReturn(managerId);
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(supportTicketRepository.findById(ticket.getId())).thenReturn(Optional.of(ticket));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.assignTicket(ticket.getId(),
                    TicketAssignRequest.builder().staffId(staffId).priority("SIÊU KHẨN").build()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_INVALID_PRIORITY);
            verify(supportTicketRepository, never()).save(any());
        }

        @Test
        @DisplayName("Mở lại phiếu chưa có ghi chú không để lại chữ 'null' và tăng reopenCount")
        void reopen_withoutExistingNote_hasNoNullPrefix() {
            SupportTicket ticket = openTicket();
            ticket.setStatus(TicketStatus.RESOLVED);
            ticket.setResolvedAt(LocalDateTime.now());
            ticket.setResolutionNote(null);

            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(supportTicketRepository.findById(ticket.getId())).thenReturn(Optional.of(ticket));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));

            SupportTicketResponse res = supportTicketService.reopenTicket(ticket.getId(), "Chưa hết lỗi");

            assertThat(res.getStatus()).isEqualTo("REOPENED");
            assertThat(res.getReopenCount()).isEqualTo(1);
            assertThat(res.getReopenReason()).isEqualTo("Chưa hết lỗi");
            assertThat(res.getResolutionNote()).isNull();
            assertThat(ticket.getResolvedAt()).isNull();
        }

        @Test
        @DisplayName("Phiếu chung không gắn kho: lấy cơ sở của đơn gần nhất của khách")
        void createGeneralTicket_usesFacilityOfLatestBooking() {
            SupportTicketRequest request = SupportTicketRequest.builder()
                    .category("OTHER").title("Hỏi về giờ mở cửa").description("Cần hỗ trợ chung").build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(bookingRepository.findFirstByCustomer_IdOrderByCreatedAtDesc(customerId)).thenReturn(Optional.of(testBooking));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> {
                SupportTicket t = inv.getArgument(0);
                t.setId(UUID.randomUUID());
                return t;
            });

            SupportTicketResponse res = supportTicketService.createTicket(request);

            assertThat(res.getFacilityId()).isEqualTo(facilityId);
            assertThat(res.getUnitCode()).isNull();
            verify(facilityRepository, never()).findAllByOrderByCreatedAtAsc();
        }

        @Test
        @DisplayName("Khách chưa có đơn nào và không chọn cơ sở -> TICKET_FACILITY_REQUIRED (không gán bừa cơ sở đầu tiên)")
        void createGeneralTicket_withoutAnyFacility_isRejected() {
            SupportTicketRequest request = SupportTicketRequest.builder()
                    .category("OTHER").title("Hỏi chung").description("Cần hỗ trợ").build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(bookingRepository.findFirstByCustomer_IdOrderByCreatedAtDesc(customerId)).thenReturn(Optional.empty());

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.createTicket(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_FACILITY_REQUIRED);
            verify(supportTicketRepository, never()).save(any());
        }

        @Test
        @DisplayName("my-tickets của nhân viên chỉ gồm phiếu của cơ sở mình, không phải toàn hệ thống")
        void getMyTickets_forStaff_isFacilityScoped() {
            UUID staffId = UUID.randomUUID();
            User staff = User.builder().fullName("Nhân viên An").facility(testFacility).build();
            staff.setId(staffId);
            SupportTicket mine = openTicket();

            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
            when(supportTicketRepository.findByFacility_IdOrAssignedStaff_Id(facilityId, staffId)).thenReturn(List.of(mine));

            List<SupportTicketResponse> res = supportTicketService.getMyTickets(null);

            assertThat(res).hasSize(1);
            verify(supportTicketRepository, never()).findAll();
        }

        @Test
        @DisplayName("Thống kê: thời gian xử lý trung bình và SLA tính từ dữ liệu thật, không có số cố định")
        void getStats_computesAverageAndSlaFromData() {
            LocalDateTime created = LocalDateTime.now().minusDays(2);

            SupportTicket onTime = openTicket();
            onTime.setStatus(TicketStatus.RESOLVED);
            onTime.setCreatedAt(created);
            onTime.setSlaDueAt(created.plusHours(24));
            onTime.setResolvedAt(created.plusHours(1));          // 60 minutes, within SLA

            SupportTicket late = openTicket();
            late.setStatus(TicketStatus.CLOSED);
            late.setCreatedAt(created);
            late.setSlaDueAt(created.plusHours(2));
            late.setResolvedAt(created.plusHours(5));            // 300 minutes, after SLA

            SupportTicket overdueOpen = openTicket();
            overdueOpen.setCreatedAt(created);
            overdueOpen.setSlaDueAt(created.plusHours(6));       // still open, deadline passed

            SupportTicket freshOpen = openTicket();              // still open, inside SLA

            UUID adminId = UUID.randomUUID();
            when(requestContext.currentUserId()).thenReturn(adminId);
            when(requestContext.currentUserRole()).thenReturn("ADMIN");
            when(userRepository.findById(adminId)).thenReturn(Optional.empty());
            when(supportTicketRepository.findAll()).thenReturn(List.of(onTime, late, overdueOpen, freshOpen));

            SupportTicketStatsResponse stats = supportTicketService.getStats(null);

            assertThat(stats.getTotalTickets()).isEqualTo(4);
            assertThat(stats.getOverdueTickets()).isEqualTo(1);
            assertThat(stats.getResolvedLateTickets()).isEqualTo(1);
            assertThat(stats.getResolvedOnTimeTickets()).isEqualTo(1);
            assertThat(stats.getAvgResolutionMinutes()).isEqualTo(180.0);   // (60 + 300) / 2
            assertThat(stats.getSlaCompliancePercent()).isEqualTo(50.0);     // 2 of 4 within SLA
        }

        @Test
        @DisplayName("Thống kê khi chưa có phiếu: SLA và thời gian xử lý là null, không phải 100% hay 18 phút")
        void getStats_withoutTickets_hasNoInventedFigures() {
            UUID adminId = UUID.randomUUID();
            when(requestContext.currentUserId()).thenReturn(adminId);
            when(requestContext.currentUserRole()).thenReturn("ADMIN");
            when(supportTicketRepository.findAll()).thenReturn(List.of());

            SupportTicketStatsResponse stats = supportTicketService.getStats(null);

            assertThat(stats.getSlaCompliancePercent()).isNull();
            assertThat(stats.getAvgResolutionMinutes()).isNull();
        }

        @Test
        @DisplayName("Ghi nhật ký liên hệ lưu đúng vai trò người nhận (BUSINESS_OPERATIONS_MANAGER cũ chuyển thành BUSINESS_MANAGER)")
        void contactLog_normalizesTargetRole() {
            UUID managerId = UUID.randomUUID();
            User manager = User.builder().fullName("Quản lý Trí").facility(testFacility).build();
            manager.setId(managerId);
            SupportTicket ticket = openTicket();

            when(requestContext.currentUserId()).thenReturn(managerId);
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(supportTicketRepository.findById(ticket.getId())).thenReturn(Optional.of(ticket));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(contactLogRepository.save(any(SupportTicketContactLog.class))).thenAnswer(inv -> {
                SupportTicketContactLog l = inv.getArgument(0);
                l.setId(UUID.randomUUID());
                return l;
            });

            SupportTicketContactLogResponse res = supportTicketService.recordContactLog(ticket.getId(),
                    SupportTicketContactLogRequest.builder().contactMethod("PHONE").contactTarget("0901234567")
                            .summary("Báo sự cố").targetRole("BUSINESS_OPERATIONS_MANAGER").build());
            assertThat(res.getTargetRole()).isEqualTo("BUSINESS_MANAGER");
        }
    }

    @Nested
    @DisplayName("Staff chỉ thao tác trên phiếu của cơ sở mình và phiếu được giao cho mình")
    class StaffOwnershipTests {

        private UUID staffId;
        private UUID colleagueId;
        private User staff;
        private User colleague;

        @org.junit.jupiter.api.BeforeEach
        void setUpStaff() {
            staffId = UUID.randomUUID();
            colleagueId = UUID.randomUUID();
            staff = User.builder().fullName("Nhân viên A").facility(testFacility).build();
            staff.setId(staffId);
            colleague = User.builder().fullName("Nhân viên B").facility(testFacility).build();
            colleague.setId(colleagueId);
            lenient().when(requestContext.currentUserId()).thenReturn(staffId);
            lenient().when(requestContext.currentUserRole()).thenReturn("STAFF");
            lenient().when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
            lenient().when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));
        }

        private SupportTicket ticket(TicketStatus status, User assignee) {
            SupportTicket ticket = SupportTicket.builder()
                    .title("Sự cố")
                    .customer(testCustomer)
                    .facility(testFacility)
                    .assignedStaff(assignee)
                    .status(status)
                    .build();
            ticket.setId(UUID.randomUUID());
            lenient().when(supportTicketRepository.findById(ticket.getId())).thenReturn(Optional.of(ticket));
            return ticket;
        }

        @Test
        @DisplayName("Nhận phiếu chưa ai nhận: gán cho mình và chuyển sang IN_PROGRESS")
        void take_freeTicket_assignsToCaller() {
            SupportTicket ticket = ticket(TicketStatus.OPEN, null);

            SupportTicketResponse res = supportTicketService.takeOwnership(ticket.getId());

            assertThat(res.getStatus()).isEqualTo("IN_PROGRESS");
            assertThat(ticket.getAssignedStaff()).isEqualTo(staff);
        }

        @Test
        @DisplayName("Nhận phiếu đang do đồng nghiệp xử lý bị từ chối (409), phiếu không đổi người phụ trách")
        void take_ticketAssignedToColleague_isRejected() {
            SupportTicket ticket = ticket(TicketStatus.IN_PROGRESS, colleague);

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.takeOwnership(ticket.getId()));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_ALREADY_TAKEN);
            assertThat(ticket.getAssignedStaff()).isEqualTo(colleague);
            verify(supportTicketRepository, never()).save(any());
        }

        @Test
        @DisplayName("Quản lý cơ sở được phân công lại phiếu bằng cách nhận phiếu của nhân viên")
        void take_facilityManagerMayTakeOverATicket() {
            UUID managerId = UUID.randomUUID();
            User manager = User.builder().fullName("Quản lý").facility(testFacility).build();
            manager.setId(managerId);
            when(requestContext.currentUserId()).thenReturn(managerId);
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            SupportTicket ticket = ticket(TicketStatus.IN_PROGRESS, colleague);

            supportTicketService.takeOwnership(ticket.getId());

            assertThat(ticket.getAssignedStaff()).isEqualTo(manager);
        }

        @Test
        @DisplayName("Tài khoản nhân viên chưa gán cơ sở không thao tác được phiếu nào")
        void staffWithoutFacility_cannotTouchTickets() {
            staff.setFacility(null);
            SupportTicket ticket = ticket(TicketStatus.OPEN, null);

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.takeOwnership(ticket.getId()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_FACILITY_MISMATCH);
            AppException view = assertThrows(AppException.class, () -> supportTicketService.getTicketById(ticket.getId()));
            assertThat(view.getErrorCode()).isEqualTo(ErrorCode.TICKET_FACILITY_MISMATCH);
        }

        @Test
        @DisplayName("Báo hoàn tất phiếu của đồng nghiệp bị từ chối")
        void resolve_ticketOfColleague_isRejected() {
            SupportTicket ticket = ticket(TicketStatus.IN_PROGRESS, colleague);

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.resolveTicket(ticket.getId(), "hijack"));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_NOT_ASSIGNED_TO_YOU);
            assertThat(ticket.getStatus()).isEqualTo(TicketStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("Báo hoàn tất phiếu chưa ai nhận (OPEN) bị từ chối")
        void resolve_openUnassignedTicket_isRejected() {
            SupportTicket ticket = ticket(TicketStatus.OPEN, null);

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.resolveTicket(ticket.getId(), "Đã xử lý"));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_NOT_ASSIGNED_TO_YOU);
            assertThat(ticket.getStatus()).isEqualTo(TicketStatus.OPEN);
        }

        @Test
        @DisplayName("Báo hoàn tất phiếu của mình nhưng chưa ở trạng thái IN_PROGRESS (vừa mở lại) bị từ chối")
        void resolve_reopenedTicket_requiresTakingItFirst() {
            SupportTicket ticket = ticket(TicketStatus.REOPENED, staff);

            AppException ex = assertThrows(AppException.class, () -> supportTicketService.resolveTicket(ticket.getId(), "Đã xử lý"));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_NOT_IN_PROGRESS);
        }

        @Test
        @DisplayName("Ghi chú xử lý trống hoặc chỉ khoảng trắng bị từ chối")
        void resolve_blankNote_isRejected() {
            SupportTicket ticket = ticket(TicketStatus.IN_PROGRESS, staff);

            for (String note : new String[]{null, "", "   "}) {
                AppException ex = assertThrows(AppException.class, () -> supportTicketService.resolveTicket(ticket.getId(), note));
                assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_RESOLUTION_NOTE_REQUIRED);
            }
            assertThat(ticket.getStatus()).isEqualTo(TicketStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("Người được giao báo hoàn tất kèm ghi chú -> RESOLVED")
        void resolve_byAssigneeWithNote_succeeds() {
            SupportTicket ticket = ticket(TicketStatus.IN_PROGRESS, staff);

            SupportTicketResponse res = supportTicketService.resolveTicket(ticket.getId(), "  Đã thay pin khóa  ");

            assertThat(res.getStatus()).isEqualTo("RESOLVED");
            assertThat(ticket.getResolutionNote()).contains("Hoàn tất xử lý: Đã thay pin khóa");
        }

        @Test
        @DisplayName("PATCH status của phiếu đồng nghiệp bị từ chối; không có chuyển ngược về OPEN")
        void updateStatus_rules() {
            SupportTicket colleagueTicket = ticket(TicketStatus.IN_PROGRESS, colleague);
            AppException notYours = assertThrows(AppException.class, () -> supportTicketService.updateStatus(
                    colleagueTicket.getId(), TicketStatusUpdateRequest.builder().status("RESOLVED").note("x").build()));
            assertThat(notYours.getErrorCode()).isEqualTo(ErrorCode.TICKET_NOT_ASSIGNED_TO_YOU);

            SupportTicket mine = ticket(TicketStatus.IN_PROGRESS, staff);
            AppException backwards = assertThrows(AppException.class, () -> supportTicketService.updateStatus(
                    mine.getId(), TicketStatusUpdateRequest.builder().status("OPEN").build()));
            assertThat(backwards.getErrorCode()).isEqualTo(ErrorCode.TICKET_INVALID_STATUS_TRANSITION);
            assertThat(mine.getStatus()).isEqualTo(TicketStatus.IN_PROGRESS);

            AppException noNote = assertThrows(AppException.class, () -> supportTicketService.updateStatus(
                    mine.getId(), TicketStatusUpdateRequest.builder().status("RESOLVED").build()));
            assertThat(noNote.getErrorCode()).isEqualTo(ErrorCode.TICKET_RESOLUTION_NOTE_REQUIRED);

            SupportTicketResponse resolved = supportTicketService.updateStatus(
                    mine.getId(), TicketStatusUpdateRequest.builder().status("RESOLVED").note("Đã xong").build());
            assertThat(resolved.getStatus()).isEqualTo("RESOLVED");
        }

        @Test
        @DisplayName("PATCH status chuyển phiếu tự do sang IN_PROGRESS = nhận phiếu")
        void updateStatus_claimingAFreeTicketAssignsIt() {
            SupportTicket free = ticket(TicketStatus.OPEN, null);

            SupportTicketResponse res = supportTicketService.updateStatus(
                    free.getId(), TicketStatusUpdateRequest.builder().status("IN_PROGRESS").build());

            assertThat(res.getStatus()).isEqualTo("IN_PROGRESS");
            assertThat(free.getAssignedStaff()).isEqualTo(staff);
        }

        @Test
        @DisplayName("Nhân viên không đóng phiếu bằng PATCH status; phiếu OPEN không nhảy thẳng sang RESOLVED")
        void updateStatus_staffCannotCloseOrSkipSteps() {
            SupportTicket open = ticket(TicketStatus.OPEN, staff);
            AppException skip = assertThrows(AppException.class, () -> supportTicketService.updateStatus(
                    open.getId(), TicketStatusUpdateRequest.builder().status("RESOLVED").note("x").build()));
            assertThat(skip.getErrorCode()).isEqualTo(ErrorCode.TICKET_INVALID_STATUS_TRANSITION);

            SupportTicket resolved = ticket(TicketStatus.RESOLVED, staff);
            AppException close = assertThrows(AppException.class, () -> supportTicketService.updateStatus(
                    resolved.getId(), TicketStatusUpdateRequest.builder().status("CLOSED").build()));
            assertThat(close.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }
    }

    @Nested
    @DisplayName("Tạo phiếu: danh mục và minh chứng được kiểm tra")
    class CreateValidationTests {

        private SupportTicketRequest.SupportTicketRequestBuilder base() {
            return SupportTicketRequest.builder()
                    .customerId(customerId)
                    .bookingId(bookingId)
                    .category("LOCK_ISSUE")
                    .title("Kẹt khóa")
                    .description("Khóa không nhận mã")
                    .priority("MEDIUM");
        }

        private void arrange() {
            lenient().when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            lenient().when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            lenient().when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> {
                SupportTicket t = inv.getArgument(0);
                t.setId(UUID.randomUUID());
                return t;
            });
        }

        @Test
        @DisplayName("Danh mục lạ hoặc để trống bị từ chối (400), không còn rơi về OTHER")
        void unknownCategory_isRejected() {
            arrange();
            for (String category : new String[]{"BOGUS", "", null, "lock"}) {
                AppException ex = assertThrows(AppException.class,
                        () -> supportTicketService.createTicket(base().category(category).build()));
                assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_INVALID_CATEGORY);
            }
            verify(supportTicketRepository, never()).save(any());
        }

        @Test
        @DisplayName("Danh mục hợp lệ không phân biệt hoa thường")
        void knownCategory_isAccepted() {
            arrange();
            assertThat(supportTicketService.createTicket(base().category("pin_code").build()).getCategory()).isEqualTo("PIN_CODE");
        }

        @Test
        @DisplayName("Minh chứng là link ngoài, javascript: hoặc data: bị từ chối")
        void foreignEvidence_isRejected() {
            arrange();
            for (String url : new String[]{"http://evil.example/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA",
                    "/uploads/../etc/passwd", "/uploads/tickets/../../x.jpg", "//evil.example/uploads/tickets/a.jpg"}) {
                AppException ex = assertThrows(AppException.class,
                        () -> supportTicketService.createTicket(base().evidenceUrls(List.of(url)).build()));
                assertThat(ex.getErrorCode()).as(url).isEqualTo(ErrorCode.TICKET_EVIDENCE_INVALID);
            }
            verify(supportTicketRepository, never()).save(any());
            verify(fileStorageService, never()).requireOwnUploads(any(), anyString());
        }

        @Test
        @DisplayName("Minh chứng hợp lệ phải là tệp của chính người gửi: kiểm tra qua FileStorageService, link ký số được lưu dạng đường dẫn gốc")
        void uploadedEvidence_isCheckedAgainstTheUploader() {
            arrange();
            doThrow(new AppException(ErrorCode.TICKET_EVIDENCE_INVALID)).when(fileStorageService).requireOwnUploads(any(), eq("tickets"));
            AppException ex = assertThrows(AppException.class, () -> supportTicketService.createTicket(
                    base().evidenceUrls(List.of("/uploads/tickets/not-mine.jpg")).build()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_EVIDENCE_INVALID);
        }

        @Test
        @DisplayName("Link ký số dán lại được lưu thành đường dẫn gốc, không kèm chữ ký")
        void signedLink_isStoredAsThePlainPath() {
            arrange();
            SupportTicketResponse res = supportTicketService.createTicket(
                    base().evidenceUrls(List.of("/uploads/tickets/evidence-1.jpg?exp=1&sig=abc")).build());
            assertThat(res.getEvidenceUrls()).containsExactly("/uploads/tickets/evidence-1.jpg");
            verify(fileStorageService).requireOwnUploads(List.of("/uploads/tickets/evidence-1.jpg"), "tickets");
        }
    }

    @Nested
    @DisplayName("Khách nhận thông báo trong ứng dụng khi phiếu được tiếp nhận và khi xử lý xong")
    class CustomerNoticeTests {

        private User staff;
        private User customer;

        @org.junit.jupiter.api.BeforeEach
        void setUpNotice() {
            UUID staffId = UUID.randomUUID();
            staff = User.builder().fullName("Nhân viên A").facility(testFacility).build();
            staff.setId(staffId);
            customer = User.builder().fullName("Khách A").email("khach@example.com")
                    .role(Role.builder().name("CUSTOMER").build()).build();
            customer.setId(UUID.randomUUID());
            lenient().when(requestContext.currentUserId()).thenReturn(staffId);
            lenient().when(requestContext.currentUserRole()).thenReturn("STAFF");
            lenient().when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
            lenient().when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(inv -> inv.getArgument(0));
        }

        private SupportTicket ticket(TicketStatus status, User assignee, User raisedBy) {
            SupportTicket ticket = SupportTicket.builder()
                    .ticketCode("TK-261021-0001")
                    .title("Khóa cửa kẹt")
                    .customer(raisedBy)
                    .facility(testFacility)
                    .assignedStaff(assignee)
                    .status(status)
                    .build();
            ticket.setId(UUID.randomUUID());
            lenient().when(supportTicketRepository.findById(ticket.getId())).thenReturn(Optional.of(ticket));
            return ticket;
        }

        private com.boxora.entity.NotificationLog savedNotice() {
            org.mockito.ArgumentCaptor<com.boxora.entity.NotificationLog> captor =
                    org.mockito.ArgumentCaptor.forClass(com.boxora.entity.NotificationLog.class);
            verify(notificationLogRepository).save(captor.capture());
            return captor.getValue();
        }

        @Test
        @DisplayName("Nhận phiếu: khách có thông báo trong ứng dụng, không lộ mã trạng thái")
        void takingTheTicketNotifiesTheCustomer() {
            SupportTicket ticket = ticket(TicketStatus.OPEN, null, customer);

            supportTicketService.takeOwnership(ticket.getId());

            com.boxora.entity.NotificationLog notice = savedNotice();
            assertThat(notice.getRecipient()).isEqualTo(customer);
            assertThat(notice.getNotificationType()).isEqualTo(com.boxora.enums.NotificationType.TICKET_UPDATE);
            assertThat(notice.getChannel()).isEqualTo(com.boxora.enums.NotificationChannel.IN_APP);
            assertThat(notice.getReferenceId()).isEqualTo(ticket.getId());
            assertThat(notice.getTitle()).isEqualTo("Phiếu hỗ trợ TK-261021-0001 đã được tiếp nhận");
            assertThat(notice.getContent()).contains("Nhân viên A", "Khóa cửa kẹt").doesNotContain("IN_PROGRESS");
        }

        @Test
        @DisplayName("Xử lý xong: khách có thông báo mời xem kết quả và xác nhận đóng phiếu")
        void resolvingTheTicketNotifiesTheCustomer() {
            SupportTicket ticket = ticket(TicketStatus.IN_PROGRESS, staff, customer);

            supportTicketService.resolveTicket(ticket.getId(), "Đã thay pin khóa");

            com.boxora.entity.NotificationLog notice = savedNotice();
            assertThat(notice.getTitle()).isEqualTo("Phiếu hỗ trợ TK-261021-0001 đã được xử lý");
            assertThat(notice.getContent()).contains("xử lý xong", "xác nhận đóng phiếu").doesNotContain("RESOLVED", "Đã thay pin khóa");
        }

        @Test
        @DisplayName("Sự cố do nhân viên tự ghi nhận (không có khách) thì không gửi thông báo")
        void staffRaisedIncidentsSendNoNotice() {
            User otherStaff = User.builder().fullName("Nhân viên C").role(Role.builder().name("STAFF").build()).build();
            otherStaff.setId(UUID.randomUUID());
            SupportTicket ticket = ticket(TicketStatus.IN_PROGRESS, staff, otherStaff);

            supportTicketService.resolveTicket(ticket.getId(), "Đã xử lý");

            verifyNoInteractions(notificationLogRepository);
        }

        @Test
        @DisplayName("Nhận lại phiếu đã là của mình không gửi thêm thông báo")
        void takingAnAlreadyOwnedTicketSendsNothing() {
            SupportTicket ticket = ticket(TicketStatus.IN_PROGRESS, staff, customer);

            supportTicketService.takeOwnership(ticket.getId());

            verifyNoInteractions(notificationLogRepository);
        }

        @Test
        @DisplayName("Lưu thông báo lỗi thì phiếu vẫn được xử lý xong")
        void aFailingNoticeNeverBlocksTheTicket() {
            SupportTicket ticket = ticket(TicketStatus.IN_PROGRESS, staff, customer);
            when(notificationLogRepository.save(any())).thenThrow(new IllegalStateException("db down"));

            SupportTicketResponse res = supportTicketService.resolveTicket(ticket.getId(), "Đã xử lý");

            assertThat(res.getStatus()).isEqualTo("RESOLVED");
        }
    }
}
