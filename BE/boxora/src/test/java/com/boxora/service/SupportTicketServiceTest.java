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
        lenient().when(facilityRepository.findAllByOrderByCreatedAtAsc()).thenReturn(List.of(testFacility));
    }

    @Nested
    @DisplayName("Create Ticket Tests with Evidence URLs")
    class CreateTicketTests {

        @Test
        @DisplayName("createTicket should save imageEvidence string and parse into evidenceUrls response")
        void createTicket_withSingleImageEvidence_shouldSucceed() {
            String testImageUrl = "https://images.unsplash.com/photo-lock-issue.jpg";
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
                    "https://images.unsplash.com/img1.jpg",
                    "https://images.unsplash.com/img2.jpg",
                    "https://images.unsplash.com/img3.jpg"
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
            assertThat(response.getImageEvidence()).contains("img1.jpg;https://images.unsplash.com/img2.jpg;https://images.unsplash.com/img3.jpg");
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
                    FileUploadResponse.builder().fileUrl("https://storage/img1.png").fileName("img1.png").build(),
                    FileUploadResponse.builder().fileUrl("https://storage/img2.jpg").fileName("img2.jpg").build()
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
            assertThat(response.getEvidenceUrls()).containsExactly("https://storage/img1.png", "https://storage/img2.jpg");
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
            assertThat(ticket.getResolutionNote()).contains("[REOPEN YÊU CẦU XỬ LÝ LẠI]: Vẫn kêu cót két khi mở");

            // Step 3: Staff resolves again
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");
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
            assertThat(ticket.getResolutionNote()).contains("[ĐÓNG PHIẾU]: Khách hàng rất hài lòng");
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

        @Test
        @DisplayName("Staff without assigned facility queries stats -> throws FORBIDDEN (deny-by-default)")
        void staffQueriesStatsWithoutAssignedFacility_throwsForbidden() {
            UUID staffId = UUID.randomUUID();
            User unassignedStaff = User.builder().fullName("Staff Unassigned").facility(null).build();
            unassignedStaff.setId(staffId);

            when(requestContext.currentUserId()).thenReturn(staffId);
            when(requestContext.currentUserRole()).thenReturn("STAFF");
            when(userRepository.findById(staffId)).thenReturn(Optional.of(unassignedStaff));

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.getStats(null));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("getStats: Formula 5 statuses = totalTickets and real avgResolutionMinutes calculation")
        void getStats_CalculatesRealAvgResolutionMinutes_AndStatusConsistency() {
            UUID adminId = UUID.randomUUID();
            User admin = User.builder().fullName("Admin Sys").build();
            admin.setId(adminId);

            LocalDateTime now = LocalDateTime.now();

            SupportTicket t1 = SupportTicket.builder().title("T1").facility(testFacility).status(TicketStatus.OPEN).build();
            t1.setCreatedAt(now.minusHours(2));

            SupportTicket t2 = SupportTicket.builder().title("T2").facility(testFacility).status(TicketStatus.IN_PROGRESS).build();
            t2.setCreatedAt(now.minusHours(3));

            SupportTicket t3 = SupportTicket.builder().title("T3").facility(testFacility).status(TicketStatus.REOPENED).build();
            t3.setCreatedAt(now.minusHours(4));

            SupportTicket t4 = SupportTicket.builder().title("T4").facility(testFacility).status(TicketStatus.RESOLVED)
                    .resolvedAt(now).build(); // 60 mins
            t4.setCreatedAt(now.minusMinutes(60));

            SupportTicket t5 = SupportTicket.builder().title("T5").facility(testFacility).status(TicketStatus.CLOSED)
                    .resolvedAt(now).build(); // 120 mins
            t5.setCreatedAt(now.minusMinutes(120));

            when(requestContext.currentUserId()).thenReturn(adminId);
            when(requestContext.currentUserRole()).thenReturn("ADMIN");
            when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
            when(supportTicketRepository.findAll()).thenReturn(List.of(t1, t2, t3, t4, t5));

            SupportTicketStatsResponse stats = supportTicketService.getStats(null);

            assertThat(stats.getTotalTickets()).isEqualTo(5);
            assertThat(stats.getOpenTickets()).isEqualTo(1);
            assertThat(stats.getInProgressTickets()).isEqualTo(1);
            assertThat(stats.getReopenedTickets()).isEqualTo(1);
            assertThat(stats.getResolvedTickets()).isEqualTo(1);
            assertThat(stats.getClosedTickets()).isEqualTo(1);

            // Consistency verification
            long sumStatuses = stats.getOpenTickets() + stats.getInProgressTickets() + stats.getReopenedTickets()
                    + stats.getResolvedTickets() + stats.getClosedTickets();
            assertThat(sumStatuses).isEqualTo(stats.getTotalTickets());

            // Real avg calculation: (60 + 120) / 2 = 90.0 minutes
            assertThat(stats.getAvgResolutionMinutes()).isNotNull();
            assertThat(stats.getAvgResolutionMinutes()).isEqualTo(90.0);
        }

        @Test
        @DisplayName("getStats: avgResolutionMinutes is null when no resolved tickets exist (no fake 18.0)")
        void getStats_AvgResolutionMinutesNullWhenNoResolvedTickets() {
            UUID adminId = UUID.randomUUID();
            User admin = User.builder().fullName("Admin Sys").build();
            admin.setId(adminId);

            LocalDateTime now = LocalDateTime.now();
            SupportTicket t1 = SupportTicket.builder().title("T1").facility(testFacility).status(TicketStatus.OPEN).build();
            t1.setCreatedAt(now);

            when(requestContext.currentUserId()).thenReturn(adminId);
            when(requestContext.currentUserRole()).thenReturn("ADMIN");
            when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
            when(supportTicketRepository.findAll()).thenReturn(List.of(t1));

            SupportTicketStatsResponse stats = supportTicketService.getStats(null);

            assertThat(stats.getTotalTickets()).isEqualTo(1);
            assertThat(stats.getAvgResolutionMinutes()).isNull();
        }
    }
}
