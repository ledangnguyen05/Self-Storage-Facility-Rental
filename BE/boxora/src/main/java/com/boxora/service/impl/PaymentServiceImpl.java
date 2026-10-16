package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.VNPayIpnResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.PaymentMapper;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.PaymentService;
import com.boxora.service.VNPayService;
import com.boxora.entity.StorageUnit;
import com.boxora.util.VNPayUtil;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class PaymentServiceImpl implements PaymentService {

    private static final DateTimeFormatter VNP_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final java.security.SecureRandom SECURE_RANDOM = new java.security.SecureRandom();

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final PaymentMapper paymentMapper;
    private final VNPayService vnPayService;
    private final ActivityLogService activityLogService;
    private final RequestContext requestContext;
    private final com.boxora.security.FacilityAccessGuard facilityAccessGuard;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractRenewalService> contractRenewalServiceProvider;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractSigningService> contractSigningServiceProvider;
    private final com.boxora.service.StorageUnitLockService storageUnitLockService;

    private UUID extractFacilityId(Payment payment) {
        if (payment == null) return null;
        if (payment.getContract() != null && payment.getContract().getFacility() != null) {
            return payment.getContract().getFacility().getId();
        }
        if (payment.getBooking() != null && payment.getBooking().getStorageUnit() != null && payment.getBooking().getStorageUnit().getFacility() != null) {
            return payment.getBooking().getStorageUnit().getFacility().getId();
        }
        return null;
    }

    @Override
    public VNPayPaymentResponse createVNPayPayment(PaymentCreateRequest request, HttpServletRequest httpRequest) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        BigDecimal authoritativeAmount;
        if (request.getPaymentType() == PaymentType.BOOKING_PAYMENT) {
            if (booking.getStatus() != BookingStatus.PENDING_PAYMENT && booking.getStatus() != BookingStatus.PENDING_APPROVAL) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED);
            }
            if (booking.getPaymentExpiresAt() == null || !booking.getPaymentExpiresAt().isAfter(java.time.Instant.now())) {
                throw new AppException(ErrorCode.BOOKING_PAYMENT_EXPIRED);
            }
            BigDecimal monthlyFee = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                    ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal expectedInitialAmount = monthlyFee.add(booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO);
            BigDecimal totalExpected = (booking.getTotalRentalFee() != null ? booking.getTotalRentalFee() : BigDecimal.ZERO)
                    .add(booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO);
            BigDecimal depositOnly = booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO;
            BigDecimal rentalFeeOnly = booking.getTotalRentalFee() != null ? booking.getTotalRentalFee() : BigDecimal.ZERO;

            if (request.getAmount() != null && request.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal reqAmt = request.getAmount();
                boolean matchesInitial = reqAmt.compareTo(expectedInitialAmount) == 0 || reqAmt.subtract(expectedInitialAmount).abs().compareTo(BigDecimal.valueOf(1000)) <= 0;
                boolean matchesTotal = reqAmt.compareTo(totalExpected) == 0 || reqAmt.subtract(totalExpected).abs().compareTo(BigDecimal.valueOf(1000)) <= 0;
                boolean matchesDeposit = reqAmt.compareTo(depositOnly) == 0 || reqAmt.subtract(depositOnly).abs().compareTo(BigDecimal.valueOf(1000)) <= 0;
                boolean matchesRental = reqAmt.compareTo(rentalFeeOnly) == 0 || reqAmt.subtract(rentalFeeOnly).abs().compareTo(BigDecimal.valueOf(1000)) <= 0;

                if (!matchesInitial && !matchesTotal && !matchesDeposit && !matchesRental) {
                    log.warn("VNPay payment amount mismatch. Received={}, ExpectedInitial={}, TotalExpected={}, DepositOnly={}",
                            request.getAmount(), expectedInitialAmount, totalExpected, depositOnly);
                    throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
                }

                if (matchesTotal) {
                    authoritativeAmount = totalExpected;
                } else if (matchesInitial) {
                    authoritativeAmount = expectedInitialAmount;
                } else if (matchesDeposit) {
                    authoritativeAmount = depositOnly;
                } else {
                    authoritativeAmount = rentalFeeOnly;
                }
            } else {
                authoritativeAmount = totalExpected.compareTo(BigDecimal.ZERO) > 0 ? totalExpected : expectedInitialAmount;
            }
        } else {
            if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new AppException(ErrorCode.INVALID_REQUEST);
            }
            authoritativeAmount = request.getAmount();
        }

        if (authoritativeAmount == null || authoritativeAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Payment amount is 0 or negative for booking {}", booking.getBookingCode());
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_INVALID);
        }

        // Generate unique transaction reference (e.g. BOX + timestamp + 6 random chars)
        String txnRef = "BOX" + System.currentTimeMillis() + VNPayUtil.randomAlphaNumeric(6);

        // Determine client IP
        String ipAddress = null;
        if (httpRequest != null) {
            ipAddress = httpRequest.getHeader("X-Forwarded-For");
            if (ipAddress == null || ipAddress.isBlank()) {
                ipAddress = httpRequest.getRemoteAddr();
            }
        }
        if (ipAddress == null || ipAddress.isBlank()) {
            ipAddress = requestContext.currentIpAddress();
        }
        ipAddress = VNPayUtil.normalizeIp(ipAddress);

        String orderInfo = request.getOrderInfo();
        if (orderInfo == null || orderInfo.isBlank()) {
            orderInfo = "Thanh toan don dat cho " + booking.getBookingCode();
        }

        // Create PENDING payment entity with server-verified authoritative amount
        Payment payment = Payment.builder()
                .transactionId(txnRef)
                .booking(booking)
                .amount(authoritativeAmount)
                .paymentType(request.getPaymentType())
                .status(PaymentStatus.PENDING)
                .paymentMethod("VNPAY")
                .paymentTime(LocalDateTime.now())
                .build();

        payment = paymentRepository.save(payment);

        UUID facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                ? booking.getStorageUnit().getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.PAYMENT_INITIATED,
                "PAYMENT",
                payment.getId(),
                "Khoi tao giao dich thanh toan VNPAY cho booking " + booking.getBookingCode() + ", so tien: " + authoritativeAmount,
                null,
                payment.getId()
        );

        // Generate VNPay checkout URL
        String paymentUrl = vnPayService.createPaymentUrl(txnRef, authoritativeAmount, orderInfo, ipAddress);

        return VNPayPaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .transactionId(txnRef)
                .paymentId(payment.getId())
                .bookingId(booking.getId())
                .amount(payment.getAmount())
                .orderInfo(orderInfo)
                .build();
    }

    @Override
    public PaymentResponse processVNPayReturn(Map<String, String> params) {
        // 1. Verify digital signature
        boolean isValid = vnPayService.verifySignature(params);
        if (!isValid) {
            log.warn("VNPay return callback signature invalid: {}", params);
            throw new AppException(ErrorCode.INVALID_PAYMENT_SIGNATURE);
        }

        String txnRef = params.get("vnp_TxnRef");
        Payment payment = paymentRepository.findByTransactionId(txnRef)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));

        String amountStr = params.get("vnp_Amount");
        if (amountStr != null && !amountStr.isBlank()) {
            try {
                BigDecimal vnpAmount = new BigDecimal(amountStr).divide(BigDecimal.valueOf(100));
                if (payment.getAmount().compareTo(vnpAmount) != 0) {
                    throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
                }
            } catch (NumberFormatException e) {
                throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
            }
        }

        // 2. Idempotency check: if already confirmed as PAID, return existing
        if (payment.getStatus() == PaymentStatus.PAID) {
            log.info("Payment with txnRef={} has already been marked as PAID.", txnRef);
            return paymentMapper.toResponse(payment);
        }

        String responseCode = params.get("vnp_ResponseCode");
        String transactionStatus = params.get("vnp_TransactionStatus");
        String payDateStr = params.get("vnp_PayDate");

        if (payDateStr != null && payDateStr.length() == 14) {
            try {
                payment.setPaymentTime(LocalDateTime.parse(payDateStr, VNP_DATE_FORMAT));
            } catch (Exception e) {
                payment.setPaymentTime(LocalDateTime.now());
            }
        }

        boolean isSuccess = "00".equals(responseCode) && ("00".equals(transactionStatus) || transactionStatus == null);

        if (isSuccess) {
            payment.setStatus(PaymentStatus.PAID);

            // Update Booking status & deposit amount if applicable
            Booking booking = payment.getBooking();
            if (booking != null) {
                // Pessimistic lock on booking to prevent race condition with expiration jobs
                booking = bookingRepository.findByIdForUpdate(booking.getId()).orElse(booking);
                // Nếu thanh toán thành công sau khi reservation hết hạn/bị hủy, đưa vào đối soát thay vì tự cấp kho
                if (booking.getStatus() == BookingStatus.CANCELLED) {
                    log.warn("[PAYMENT_EXPIRED] Payment {} received after booking {} was already CANCELLED. Flagged for refund/reconciliation.",
                            txnRef, booking.getBookingCode());
                    payment.setStatus(PaymentStatus.REFUND_PENDING);
                    paymentRepository.save(payment);
                    return paymentMapper.toResponse(payment);
                }

                if (booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL) {
                    booking.setStatus(BookingStatus.CONFIRMED);
                    booking.setPaymentExpiresAt(null);
                    booking.setHoldExpiresAt(null);
                    if (payment.getPaymentType() == PaymentType.BOOKING_PAYMENT) {
                        booking.setDepositPaid(booking.getDepositAmount() != null ? booking.getDepositAmount() : payment.getAmount());
                        booking.setPaymentStatus("PAID");
                    } else if (payment.getPaymentType() == PaymentType.DEPOSIT) {
                        BigDecimal cur = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
                        booking.setDepositPaid(cur.add(payment.getAmount()));
                        booking.setPaymentStatus("PARTIALLY_PAID");
                    }
                    if (booking.getStorageUnit() != null) {
                        storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
                    }
                } else if (payment.getPaymentType() == PaymentType.DEPOSIT) {
                    BigDecimal currentDeposit = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
                    booking.setDepositPaid(currentDeposit.add(payment.getAmount()));
                    booking.setHoldExpiresAt(null);
                    booking.setPaymentStatus("PARTIALLY_PAID");
                }

                // Lưu ý (P0-03 & BR-RULE-005): Không cấp mã PIN/QR ở bước thanh toán.
                // Quyền truy cập PIN/QR chỉ được cấp phát chính thức khi nhân viên hoàn tất thủ tục bàn giao check-in.
                bookingRepository.save(booking);

                com.boxora.service.ContractSigningService contractSigningService = contractSigningServiceProvider.getIfAvailable();
                if (contractSigningService != null) {
                    try {
                        contractSigningService.ensureContractForBooking(booking);
                    } catch (Exception ex) {
                        log.warn("Khong the tu dong khoi tao hop dong DocuSeal cho booking {}: {}", booking.getBookingCode(), ex.getMessage());
                    }
                }
            }

            if (payment.getPaymentType() == PaymentType.RENEWAL_FEE) {
                ContractRenewalService renewalService = contractRenewalServiceProvider.getIfAvailable();
                if (renewalService != null) {
                    renewalService.handleRenewalPaid(payment);
                }
            }

            String targetDesc = payment.getBooking() != null
                    ? "booking " + payment.getBooking().getBookingCode()
                    : "hop dong " + (payment.getContract() != null ? payment.getContract().getId() : "N/A");

            UUID facilityId = extractFacilityId(payment);
            activityLogService.record(
                    facilityId,
                    ActivityAction.PAYMENT_CONFIRMED,
                    "PAYMENT",
                    payment.getId(),
                    "Thanh toan VNPAY thanh cong cho " + targetDesc + ", ma GD: " + txnRef,
                    PaymentStatus.PENDING,
                    PaymentStatus.PAID
            );
        } else {
            payment.setStatus(PaymentStatus.FAILED);

            String targetDesc = payment.getBooking() != null
                    ? "booking " + payment.getBooking().getBookingCode()
                    : "hop dong " + (payment.getContract() != null ? payment.getContract().getId() : "N/A");

            UUID facilityId = extractFacilityId(payment);
            activityLogService.record(
                    facilityId,
                    ActivityAction.PAYMENT_FAILED,
                    "PAYMENT",
                    payment.getId(),
                    "Thanh toan VNPAY that bai hoac bi huy cho " + targetDesc + ", responseCode: " + responseCode,
                    PaymentStatus.PENDING,
                    PaymentStatus.FAILED
            );
        }

        payment = paymentRepository.save(payment);
        return paymentMapper.toResponse(payment);
    }

    @Override
    public VNPayIpnResponse processVNPayIPN(Map<String, String> params) {
        // 1. Verify Checksum
        if (!vnPayService.verifySignature(params)) {
            log.warn("VNPay IPN checksum verification failed for params: {}", params);
            return VNPayIpnResponse.invalidSignature();
        }

        String txnRef = params.get("vnp_TxnRef");
        Optional<Payment> optPayment = paymentRepository.findByTransactionId(txnRef);
        if (optPayment.isEmpty()) {
            log.warn("VNPay IPN order not found: txnRef={}", txnRef);
            return VNPayIpnResponse.orderNotFound();
        }

        Payment payment = optPayment.get();

        // 2. Check Amount
        String amountStr = params.get("vnp_Amount");
        if (amountStr != null && !amountStr.isBlank()) {
            try {
                BigDecimal vnpAmount = new BigDecimal(amountStr).divide(BigDecimal.valueOf(100));
                if (payment.getAmount().compareTo(vnpAmount) != 0) {
                    log.warn("VNPay IPN amount mismatch for txnRef={}. DB={}, VNPay={}",
                            txnRef, payment.getAmount(), vnpAmount);
                    return VNPayIpnResponse.invalidAmount();
                }
            } catch (Exception e) {
                log.error("Failed to parse VNPay IPN amount: {}", amountStr, e);
                return VNPayIpnResponse.invalidAmount();
            }
        }

        // 3. Check if already confirmed
        if (payment.getStatus() == PaymentStatus.PAID) {
            return VNPayIpnResponse.alreadyConfirmed();
        }

        // 4. Update status
        String responseCode = params.get("vnp_ResponseCode");
        String transactionStatus = params.get("vnp_TransactionStatus");
        boolean isSuccess = "00".equals(responseCode) && ("00".equals(transactionStatus) || transactionStatus == null);

        String payDateStr = params.get("vnp_PayDate");
        if (payDateStr != null && payDateStr.length() == 14) {
            try {
                payment.setPaymentTime(LocalDateTime.parse(payDateStr, VNP_DATE_FORMAT));
            } catch (Exception e) {
                payment.setPaymentTime(LocalDateTime.now());
            }
        }

        if (isSuccess) {
            payment.setStatus(PaymentStatus.PAID);

            Booking booking = payment.getBooking();
            if (booking != null) {
                // Pessimistic lock on booking to prevent race condition with expiration jobs
                booking = bookingRepository.findByIdForUpdate(booking.getId()).orElse(booking);
                if (booking.getStatus() == BookingStatus.CANCELLED) {
                    log.warn("[PAYMENT_EXPIRED] VNPay IPN payment {} received after booking {} was already CANCELLED. Flagged for refund/reconciliation.",
                            txnRef, booking.getBookingCode());
                    payment.setStatus(PaymentStatus.REFUND_PENDING);
                    paymentRepository.save(payment);
                    return VNPayIpnResponse.success();
                }

                if (booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL) {
                    booking.setStatus(BookingStatus.CONFIRMED);
                    booking.setPaymentExpiresAt(null);
                    if (payment.getPaymentType() == PaymentType.BOOKING_PAYMENT) {
                        booking.setDepositPaid(booking.getDepositAmount() != null ? booking.getDepositAmount() : payment.getAmount());
                    } else if (payment.getPaymentType() == PaymentType.DEPOSIT) {
                        BigDecimal cur = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
                        booking.setDepositPaid(cur.add(payment.getAmount()));
                    }
                    if (booking.getStorageUnit() != null) {
                        storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
                    }
                } else if (payment.getPaymentType() == PaymentType.DEPOSIT) {
                    BigDecimal currentDeposit = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
                    booking.setDepositPaid(currentDeposit.add(payment.getAmount()));
                }

                // Lưu ý (P0-03 & BR-RULE-005): Không cấp mã PIN/QR ở bước thanh toán.
                // Quyền truy cập PIN/QR chỉ được cấp phát chính thức khi nhân viên hoàn tất thủ tục bàn giao check-in.
                bookingRepository.save(booking);

                com.boxora.service.ContractSigningService contractSigningService = contractSigningServiceProvider.getIfAvailable();
                if (contractSigningService != null) {
                    try {
                        contractSigningService.ensureContractForBooking(booking);
                    } catch (Exception ex) {
                        log.warn("Khong the tu dong khoi tao hop dong DocuSeal cho booking qua IPN {}: {}", booking.getBookingCode(), ex.getMessage());
                    }
                }
            }

            if (payment.getPaymentType() == PaymentType.RENEWAL_FEE) {
                ContractRenewalService renewalService = contractRenewalServiceProvider.getIfAvailable();
                if (renewalService != null) {
                    renewalService.handleRenewalPaid(payment);
                }
            }

            UUID facilityId = extractFacilityId(payment);
            activityLogService.recordSystem(
                    facilityId,
                    ActivityAction.PAYMENT_CONFIRMED,
                    "PAYMENT",
                    payment.getId(),
                    "IPN VNPAY xac nhan thanh cong cho txnRef=" + txnRef
            );
        } else {
            payment.setStatus(PaymentStatus.FAILED);

            UUID facilityId = extractFacilityId(payment);
            activityLogService.recordSystem(
                    facilityId,
                    ActivityAction.PAYMENT_FAILED,
                    "PAYMENT",
                    payment.getId(),
                    "IPN VNPAY xac nhan that bai cho txnRef=" + txnRef + ", responseCode=" + responseCode
            );
        }

        paymentRepository.save(payment);
        return VNPayIpnResponse.success();
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentResponse getById(UUID id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        return paymentMapper.toResponse(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentResponse getByTransactionId(String transactionId) {
        Payment payment = paymentRepository.findByTransactionId(transactionId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        return paymentMapper.toResponse(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponse> getByBookingId(UUID bookingId) {
        List<Payment> payments = paymentRepository.findAllByBooking_Id(bookingId);
        return payments.stream().map(paymentMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponse> getMyPayments() {
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId == null) {
            return List.of();
        }

        Specification<Payment> spec = (root, query, cb) -> {
            query.orderBy(cb.desc(cb.coalesce(root.get("paymentTime"), root.get("createdAt"))));
            Join<Payment, Booking> bookingJoin = root.join("booking", JoinType.LEFT);
            Join<Payment, RentalContract> contractJoin = root.join("contract", JoinType.LEFT);

            return cb.or(
                    cb.equal(bookingJoin.get("customer").get("id"), currentUserId),
                    cb.equal(contractJoin.get("customer").get("id"), currentUserId)
            );
        };

        return paymentRepository.findAll(spec).stream().map(paymentMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> getAll(
            UUID bookingId,
            UUID facilityId,
            UUID customerId,
            PaymentStatus status,
            PaymentType paymentType,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) {
        Sort sort = sortDir.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        UUID scopedFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        UUID effectiveCustomerId = customerId;
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            effectiveCustomerId = requestContext.currentUserId();
        }

        final UUID queryFacilityId = scopedFacilityId;
        final UUID queryCustomerId = effectiveCustomerId;

        Specification<Payment> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            Join<Payment, Booking> bookingJoin = root.join("booking", JoinType.LEFT);
            Join<Booking, StorageUnit> suJoin = bookingJoin.join("storageUnit", JoinType.LEFT);
            Join<Payment, RentalContract> contractJoin = root.join("contract", JoinType.LEFT);

            if (queryFacilityId != null) {
                predicates.add(cb.or(
                        cb.equal(suJoin.get("facility").get("id"), queryFacilityId),
                        cb.equal(contractJoin.get("facility").get("id"), queryFacilityId)
                ));
            }

            if (queryCustomerId != null) {
                predicates.add(cb.or(
                        cb.equal(bookingJoin.get("customer").get("id"), queryCustomerId),
                        cb.equal(contractJoin.get("customer").get("id"), queryCustomerId)
                ));
            }

            if (bookingId != null) {
                predicates.add(cb.equal(root.get("booking").get("id"), bookingId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (paymentType != null) {
                predicates.add(cb.equal(root.get("paymentType"), paymentType));
            }
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("paymentTime"), fromDate));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("paymentTime"), toDate));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Payment> result = paymentRepository.findAll(spec, pageable);
        return PageResponse.from(result.map(paymentMapper::toResponse));
    }

    @Override
    @Transactional
    public VNPayPaymentResponse createContractPayment(
            RentalContract contract, PaymentType type, BigDecimal amount,
            Integer renewalMonths, String orderInfo, HttpServletRequest httpRequest) {

        String txnRef = "BOX" + System.currentTimeMillis() + VNPayUtil.randomAlphaNumeric(6);

        String ipAddress = null;
        if (httpRequest != null) {
            ipAddress = httpRequest.getHeader("X-Forwarded-For");
            if (ipAddress == null || ipAddress.isBlank()) {
                ipAddress = httpRequest.getRemoteAddr();
            }
        }
        if (ipAddress == null || ipAddress.isBlank()) {
            ipAddress = requestContext.currentIpAddress();
        }
        ipAddress = VNPayUtil.normalizeIp(ipAddress);

        if (orderInfo == null || orderInfo.isBlank()) {
            orderInfo = "Thanh toan phi gia han hop dong " + (contract.getContractCode() != null ? contract.getContractCode() : contract.getId());
        }

        Payment payment = Payment.builder()
                .transactionId(txnRef)
                .contract(contract)
                .amount(amount)
                .paymentType(type)
                .renewalMonths(renewalMonths)
                .status(PaymentStatus.PENDING)
                .paymentMethod("VNPAY")
                .paymentTime(LocalDateTime.now())
                .build();
        payment = paymentRepository.save(payment);

        UUID facilityId = contract.getFacility() != null ? contract.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.PAYMENT_INITIATED,
                "PAYMENT",
                payment.getId(),
                "Khoi tao thanh toan phi gia han hop dong " + contract.getId() + ", so tien: " + amount,
                null,
                payment.getId()
        );

        String paymentUrl = vnPayService.createPaymentUrl(txnRef, amount, orderInfo, ipAddress);

        return VNPayPaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .transactionId(txnRef)
                .paymentId(payment.getId())
                .contractId(contract.getId())
                .amount(payment.getAmount())
                .orderInfo(orderInfo)
                .build();
    }
}
