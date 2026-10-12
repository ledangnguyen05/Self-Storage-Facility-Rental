package com.boxora.service;

import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.SupportTicket;
import com.boxora.entity.User;
import com.boxora.enums.TicketCategory;
import com.boxora.enums.TicketStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupportTicketServiceTest {

    @Mock
    private SupportTicketRepository supportTicketRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private FileStorageService fileStorageService;

    @InjectMocks
    private SupportTicketServiceImpl supportTicketService;

    private User testCustomer;
    private Booking testBooking;
    private StorageUnit testUnit;
    private UUID customerId;
    private UUID bookingId;

    @BeforeEach
    void setUp() {
        customerId = UUID.randomUUID();
        bookingId = UUID.randomUUID();

        testCustomer = User.builder()
                .fullName("Lê Đăng Nguyên")
                .phone("0912345678")
                .build();
        testCustomer.setId(customerId);

        testUnit = StorageUnit.builder()
                .unitCode("A-108")
                .build();
        testUnit.setId(UUID.randomUUID());

        testBooking = Booking.builder()
                .customer(testCustomer)
                .storageUnit(testUnit)
                .build();
        testBooking.setId(bookingId);
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
                    .title("Bàn phím SmartLock bị kẹt số 3")
                    .description("Nhấn mã PIN số 3 không nhận tín hiệu.")
                    .priority("HIGH")
                    .imageEvidence(testImageUrl)
                    .build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> {
                SupportTicket t = invocation.getArgument(0);
                t.setId(UUID.randomUUID());
                t.setCreatedAt(LocalDateTime.now());
                return t;
            });

            SupportTicketResponse response = supportTicketService.createTicket(request);

            assertThat(response).isNotNull();
            assertThat(response.getImageEvidence()).isEqualTo(testImageUrl);
            assertThat(response.getEvidenceUrls()).containsExactly(testImageUrl);
            assertThat(response.getTitle()).isEqualTo("Bàn phím SmartLock bị kẹt số 3");
            assertThat(response.getPriority()).isEqualTo("HIGH");
            assertThat(response.getCategory()).isEqualTo("LOCK_ISSUE");
            assertThat(response.getUnitCode()).isEqualTo("A-108");
            verify(supportTicketRepository).save(any(SupportTicket.class));
        }

        @Test
        @DisplayName("createTicket should combine multiple evidenceUrls correctly")
        void createTicket_withMultipleEvidenceUrls_shouldCombineCorrectly() {
            List<String> urls = List.of(
                    "https://boxora.com/uploads/tickets/photo1.jpg",
                    "https://boxora.com/uploads/tickets/photo2.jpg"
            );
            SupportTicketRequest request = SupportTicketRequest.builder()
                    .customerId(customerId)
                    .bookingId(bookingId)
                    .category("FACILITY_DAMAGE")
                    .title("Cửa kho bị kẹt ray trượt")
                    .description("Cửa kho kéo nặng, có vết xước ray.")
                    .evidenceUrls(urls)
                    .build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> {
                SupportTicket t = invocation.getArgument(0);
                t.setId(UUID.randomUUID());
                t.setCreatedAt(LocalDateTime.now());
                return t;
            });

            SupportTicketResponse response = supportTicketService.createTicket(request);

            assertThat(response).isNotNull();
            assertThat(response.getImageEvidence()).contains("photo1.jpg").contains("photo2.jpg");
            assertThat(response.getEvidenceUrls()).hasSize(2).containsAll(urls);
        }

        @Test
        @DisplayName("createTicket should combine both single imageEvidence and list of evidenceUrls")
        void createTicket_withBothSingleAndList_shouldDeduplicateAndCombine() {
            String url1 = "https://cdn.example.com/lock1.jpg";
            String url2 = "https://cdn.example.com/lock2.jpg";
            SupportTicketRequest request = SupportTicketRequest.builder()
                    .customerId(customerId)
                    .imageEvidence(url1)
                    .evidenceUrls(List.of(url1, url2))
                    .title("Sự cố ổ khóa điện tử")
                    .build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

            SupportTicketResponse response = supportTicketService.createTicket(request);

            assertThat(response).isNotNull();
            assertThat(response.getEvidenceUrls()).hasSize(2).containsExactly(url1, url2);
        }

        @Test
        @DisplayName("createTicket with no image evidence should return empty evidenceUrls")
        void createTicket_withoutEvidence_shouldReturnEmptyList() {
            SupportTicketRequest request = SupportTicketRequest.builder()
                    .customerId(customerId)
                    .title("Yêu cầu hóa đơn VAT")
                    .build();

            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

            SupportTicketResponse response = supportTicketService.createTicket(request);

            assertThat(response).isNotNull();
            assertThat(response.getImageEvidence()).isNull();
            assertThat(response.getEvidenceUrls()).isEmpty();
        }
    }

    @Nested
    @DisplayName("Create Ticket with Multipart File Uploads")
    class CreateTicketWithFilesTests {

        @Test
        @DisplayName("createTicketWithFiles should store files via FileStorageService and link URLs")
        void createTicketWithFiles_shouldUploadAndCreateTicket() {
            MockMultipartFile file1 = new MockMultipartFile(
                    "files", "photo1.jpg", "image/jpeg", "image-content".getBytes()
            );
            List<MultipartFile> files = List.of(file1);

            FileUploadResponse uploadResponse = FileUploadResponse.builder()
                    .fileName("evidence-1234.jpg")
                    .fileUrl("/uploads/tickets/evidence-1234.jpg")
                    .fileType("image/jpeg")
                    .fileSize(1024L)
                    .uploadedAt(LocalDateTime.now())
                    .build();

            when(fileStorageService.storeFiles(files, "tickets")).thenReturn(List.of(uploadResponse));
            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

            SupportTicketRequest request = SupportTicketRequest.builder()
                    .customerId(customerId)
                    .title("Báo cáo sự cố rò rỉ nước trần kho")
                    .description("Nước nhỏ giọt nhẹ ở góc kho.")
                    .build();

            SupportTicketResponse response = supportTicketService.createTicketWithFiles(request, files);

            assertThat(response).isNotNull();
            assertThat(response.getEvidenceUrls()).contains("/uploads/tickets/evidence-1234.jpg");
            verify(fileStorageService).storeFiles(files, "tickets");
            verify(supportTicketRepository).save(any(SupportTicket.class));
        }
    }

    @Nested
    @DisplayName("File Storage Delegate Tests")
    class FileStorageDelegateTests {

        @Test
        @DisplayName("uploadEvidenceImage should delegate to fileStorageService")
        void uploadEvidenceImage_shouldDelegate() {
            MockMultipartFile file = new MockMultipartFile(
                    "file", "lock.jpg", "image/jpeg", "dummy".getBytes()
            );
            FileUploadResponse mockUpload = FileUploadResponse.builder()
                    .fileUrl("/uploads/tickets/lock.jpg")
                    .build();

            when(fileStorageService.storeFile(file, "tickets")).thenReturn(mockUpload);

            FileUploadResponse result = supportTicketService.uploadEvidenceImage(file);

            assertThat(result.getFileUrl()).isEqualTo("/uploads/tickets/lock.jpg");
            verify(fileStorageService).storeFile(file, "tickets");
        }

        @Test
        @DisplayName("uploadEvidenceImages should delegate batch upload to fileStorageService")
        void uploadEvidenceImages_shouldDelegate() {
            MockMultipartFile file1 = new MockMultipartFile("files", "img1.png", "image/png", "a".getBytes());
            MockMultipartFile file2 = new MockMultipartFile("files", "img2.png", "image/png", "b".getBytes());
            List<MultipartFile> files = List.of(file1, file2);

            FileUploadResponse resp1 = FileUploadResponse.builder().fileUrl("/uploads/tickets/img1.png").build();
            FileUploadResponse resp2 = FileUploadResponse.builder().fileUrl("/uploads/tickets/img2.png").build();

            when(fileStorageService.storeFiles(files, "tickets")).thenReturn(List.of(resp1, resp2));

            List<FileUploadResponse> results = supportTicketService.uploadEvidenceImages(files);

            assertThat(results).hasSize(2);
            verify(fileStorageService).storeFiles(files, "tickets");
        }
    }

    @Nested
    @DisplayName("Resolve Ticket Tests")
    class ResolveTicketTests {

        @Test
        @DisplayName("resolveTicket should set status to RESOLVED and store resolutionNote")
        void resolveTicket_success() {
            UUID ticketId = UUID.randomUUID();
            SupportTicket ticket = SupportTicket.builder()
                    .ticketCode("TK-1001")
                    .status(TicketStatus.OPEN)
                    .title("Hỏng chốt cửa")
                    .build();
            ticket.setId(ticketId);

            when(supportTicketRepository.findById(ticketId)).thenReturn(Optional.of(ticket));
            when(supportTicketRepository.save(any(SupportTicket.class))).thenAnswer(invocation -> invocation.getArgument(0));

            SupportTicketResponse response = supportTicketService.resolveTicket(ticketId, "Kỹ thuật đã thay chốt mới.");

            assertThat(response).isNotNull();
            assertThat(response.getStatus()).isEqualTo("RESOLVED");
            assertThat(response.getResolutionNote()).isEqualTo("Kỹ thuật đã thay chốt mới.");
            verify(supportTicketRepository).save(ticket);
        }

        @Test
        @DisplayName("resolveTicket with non-existent id should throw AppException TICKET_NOT_FOUND")
        void resolveTicket_notFound_shouldThrowException() {
            UUID randomId = UUID.randomUUID();
            when(supportTicketRepository.findById(randomId)).thenReturn(Optional.empty());

            AppException ex = assertThrows(AppException.class, () ->
                    supportTicketService.resolveTicket(randomId, "Lý do"));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TICKET_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("Get Queue and Customer Tickets Tests")
    class QueryTicketTests {

        @Test
        @DisplayName("getQueue should return all tickets with parsed evidenceUrls")
        void getQueue_success() {
            SupportTicket t1 = SupportTicket.builder()
                    .ticketCode("TK-01")
                    .imageEvidence("https://test.com/img1.jpg;/uploads/tickets/img2.jpg")
                    .customer(testCustomer)
                    .build();
            t1.setId(UUID.randomUUID());

            when(supportTicketRepository.findAll()).thenReturn(List.of(t1));

            List<SupportTicketResponse> queue = supportTicketService.getQueue();

            assertThat(queue).hasSize(1);
            assertThat(queue.get(0).getEvidenceUrls()).containsExactly(
                    "https://test.com/img1.jpg",
                    "/uploads/tickets/img2.jpg"
            );
        }

        @Test
        @DisplayName("getMyTickets should filter tickets by customer ID")
        void getMyTickets_shouldFilterByCustomerId() {
            User otherUser = User.builder().build();
            otherUser.setId(UUID.randomUUID());
            SupportTicket t1 = SupportTicket.builder().customer(testCustomer).build();
            t1.setId(UUID.randomUUID());
            SupportTicket t2 = SupportTicket.builder().customer(otherUser).build();
            t2.setId(UUID.randomUUID());

            when(supportTicketRepository.findAll()).thenReturn(List.of(t1, t2));

            List<SupportTicketResponse> list = supportTicketService.getMyTickets(customerId);

            assertThat(list).hasSize(1);
            assertThat(list.get(0).getCustomerId()).isEqualTo(customerId);
        }
    }
}

