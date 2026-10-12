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
import com.boxora.util.VNPayUtil;
import com.boxora.entity.Facility;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.service.EmailService;
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

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final RentalContractRepository rentalContractRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final PaymentMapper paymentMapper;
    private final VNPayService vnPayService;
    private final ActivityLogService activityLogService;
    private final EmailService emailService;
    private final RequestContext requestContext;
    private final com.boxora.security.FacilityAccessGuard facilityAccessGuard;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractRenewalService> contractRenewalServiceProvider;

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
        if (request.getBookingId() == null && request.getContractId() == null) {
            throw new AppException(ErrorCode.PAYMENT_TARGET_REQUIRED);
        }

        Booking booking = null;
        RentalContract contract = null;
        UUID facilityId = null;

        if (request.getBookingId() != null) {
            booking = bookingRepository.findById(request.getBookingId())
                    .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

            if (facilityAccessGuard.isFacilityScoped() && booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null) {
                facilityAccessGuard.checkFacilityAccess(booking.getStorageUnit().getFacility().getId());
            }
            if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
                UUID currentUserId = requestContext.currentUserId();
                if (currentUserId != null && booking.getCustomer() != null && !currentUserId.equals(booking.getCustomer().getId())) {
                    throw new AppException(ErrorCode.FORBIDDEN);
                }
            }
            facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                    ? booking.getStorageUnit().getFacility().getId() : null;
        } else {
            contract = rentalContractRepository.findById(request.getContractId())
                    .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

            if (facilityAccessGuard.isFacilityScoped() && contract.getFacility() != null) {
                facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
            }
            if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
                UUID currentUserId = requestContext.currentUserId();
                if (currentUserId != null && contract.getCustomer() != null && !currentUserId.equals(contract.getCustomer().getId())) {
                    throw new AppException(ErrorCode.FORBIDDEN);
                }
            }
            facilityId = contract.getFacility() != null ? contract.getFacility().getId() : null;
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
            if (booking != null) {
                orderInfo = "Thanh toan don dat cho " + booking.getBookingCode();
            } else {
                orderInfo = "Thanh toan hop dong " + contract.getContractCode();
            }
        }

        // Create PENDING payment entity
        Payment payment = Payment.builder()
                .transactionId(txnRef)
                .booking(booking)
                .contract(contract)
                .amount(request.getAmount())
                .paymentType(request.getPaymentType())
                .status(PaymentStatus.PENDING)
                .paymentMethod("VNPAY")
                .paymentTime(LocalDateTime.now())
                .build();

        payment = paymentRepository.save(payment);

        String logTarget = booking != null ? "booking " + booking.getBookingCode() : "hop dong " + contract.getContractCode();
        activityLogService.record(
                facilityId,
                ActivityAction.PAYMENT_INITIATED,
                "PAYMENT",
                payment.getId(),
                "Khoi tao giao dich thanh toan VNPAY cho " + logTarget + ", so tien: " + request.getAmount(),
                null,
                payment.getId()
        );

        // Generate VNPay checkout URL
        String paymentUrl = vnPayService.createPaymentUrl(txnRef, request.getAmount(), orderInfo, ipAddress);

        return VNPayPaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .transactionId(txnRef)
                .paymentId(payment.getId())
                .bookingId(booking != null ? booking.getId() : null)
                .contractId(contract != null ? contract.getId() : null)
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
            fulfillSuccessfulPayment(payment, txnRef);
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
            fulfillSuccessfulPayment(payment, txnRef);
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

    private void fulfillSuccessfulPayment(Payment payment, String txnRef) {
        payment.setStatus(PaymentStatus.PAID);

        // 1. Update Booking status & deposit amount if applicable
        Booking booking = payment.getBooking();
        if (booking != null) {
            if (payment.getPaymentType() == PaymentType.DEPOSIT) {
                BigDecimal currentDeposit = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
                booking.setDepositPaid(currentDeposit.add(payment.getAmount()));
            }
            if (booking.getStatus() == BookingStatus.PENDING_PAYMENT) {
                booking.setStatus(BookingStatus.CONFIRMED);
                if (booking.getStorageUnit() != null) {
                    StorageUnit unit = booking.getStorageUnit();
                    unit.setStatus(UnitStatus.RESERVED);
                    storageUnitRepository.save(unit);
                }
            }
            bookingRepository.save(booking);

            // Auto-create initial RentalContract in PENDING_SIGNATURE if none exists yet
            if (rentalContractRepository.findByBookingId(booking.getId()).isEmpty()) {
                StorageUnit unit = booking.getStorageUnit();
                Facility facility = unit != null ? unit.getFacility() : null;
                if (unit != null && facility != null) {
                    BigDecimal monthlyFee = (unit.getUnitType() != null && unit.getUnitType().getBasePricePerMonth() != null)
                            ? unit.getUnitType().getBasePricePerMonth() : new BigDecimal("1450000");

                    String contractCode = "CTR" + System.currentTimeMillis() + VNPayUtil.randomAlphaNumeric(4);
                    RentalContract contract = RentalContract.builder()
                            .contractCode(contractCode)
                            .customer(booking.getCustomer())
                            .unit(unit)
                            .facility(facility)
                            .booking(booking)
                            .startDate(booking.getStartDate())
                            .endDate(booking.getEndDate())
                            .monthlyFee(monthlyFee)
                            .depositHeld(booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO)
                            .status(RentalContractStatus.PENDING_SIGNATURE)
                            .build();
                    rentalContractRepository.save(contract);
                    log.info("Auto-generated RentalContract {} for booking {}", contractCode, booking.getBookingCode());
                }
            }
        }

        // 2. Handle Renewal Fee
        if (payment.getPaymentType() == PaymentType.RENEWAL_FEE) {
            ContractRenewalService renewalService = contractRenewalServiceProvider.getIfAvailable();
            if (renewalService != null) {
                renewalService.handleRenewalPaid(payment);
            }
        }

        // 3. Dispatch receipt email
        try {
            User customer = null;
            if (payment.getBooking() != null) {
                customer = payment.getBooking().getCustomer();
            } else if (payment.getContract() != null) {
                customer = payment.getContract().getCustomer();
            }
            if (customer != null && customer.getEmail() != null) {
                String targetDesc = (payment.getBooking() != null)
                        ? "Thanh toán đặt kho #" + payment.getBooking().getBookingCode()
                        : "Thanh toán hợp đồng #" + (payment.getContract() != null ? payment.getContract().getContractCode() : "N/A");

                emailService.sendPaymentSuccessEmail(
                        customer.getEmail(),
                        customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                        txnRef,
                        payment.getAmount(),
                        targetDesc
                );
            }
        } catch (Exception e) {
            log.warn("Could not send payment success email: {}", e.getMessage());
        }

        // 4. Record Activity Log
        String targetDesc = payment.getBooking() != null
                ? "booking " + payment.getBooking().getBookingCode()
                : "hop dong " + (payment.getContract() != null ? payment.getContract().getContractCode() : "N/A");

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
    public PageResponse<PaymentResponse> getAll(
            UUID bookingId,
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

        UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();

        Specification<Payment> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (scopedFacilityId != null) {
                Join<Payment, Booking> bJoin = root.join("booking", JoinType.LEFT);
                Join<Booking, StorageUnit> uJoin = bJoin.join("storageUnit", JoinType.LEFT);
                Join<StorageUnit, Facility> bfJoin = uJoin.join("facility", JoinType.LEFT);

                Join<Payment, RentalContract> cJoin = root.join("contract", JoinType.LEFT);
                Join<RentalContract, Facility> cfJoin = cJoin.join("facility", JoinType.LEFT);

                predicates.add(cb.or(
                        cb.equal(bfJoin.get("id"), scopedFacilityId),
                        cb.equal(cfJoin.get("id"), scopedFacilityId)
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
