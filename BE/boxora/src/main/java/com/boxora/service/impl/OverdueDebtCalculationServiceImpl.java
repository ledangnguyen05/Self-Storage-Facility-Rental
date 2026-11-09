package com.boxora.service.impl;

import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.enums.OverdueStage;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.repository.PaymentRepository;
import com.boxora.service.OverdueDebtCalculationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class OverdueDebtCalculationServiceImpl implements OverdueDebtCalculationService {

    private final PaymentRepository paymentRepository;

    public static BigDecimal roundUpToThousand(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return amount.divide(BigDecimal.valueOf(1000), 0, java.math.RoundingMode.CEILING)
                .multiply(BigDecimal.valueOf(1000));
    }

    @Override
    public CalculationResult calculateOverdueDebt(RentalContract contract, FacilityPolicy policy, LocalDate referenceDate) {
        LocalDate today = (referenceDate != null) ? referenceDate : LocalDate.now(VN_ZONE);
        LocalDate dueDate = contract.getEndDate();
        if (contract.getBooking() != null && contract.getBooking().getEndDate() != null) {
            if (dueDate == null || contract.getBooking().getEndDate().isBefore(dueDate)) {
                dueDate = contract.getBooking().getEndDate();
            }
        }

        long overdueDays = (dueDate != null && dueDate.isBefore(today))
                ? ChronoUnit.DAYS.between(dueDate, today)
                : 0L;

        if (overdueDays < 1 && contract != null && (contract.getStatus() == RentalContractStatus.OVERDUE || contract.getStatus() == RentalContractStatus.OVERDUE_LOCKED)) {
            overdueDays = 1L;
        }

        boolean policyValid = isPolicyValid(policy);

        String unitTypeName = "Kho";
        if (contract.getUnit() != null && contract.getUnit().getUnitType() != null && contract.getUnit().getUnitType().getTypeName() != null) {
            unitTypeName = contract.getUnit().getUnitType().getTypeName();
        } else if (contract.getBooking() != null && contract.getBooking().getStorageUnit() != null
                && contract.getBooking().getStorageUnit().getUnitType() != null
                && contract.getBooking().getStorageUnit().getUnitType().getTypeName() != null) {
            unitTypeName = contract.getBooking().getStorageUnit().getUnitType().getTypeName();
        }

        BigDecimal monthlyFee = contract.getMonthlyFee();
        if (monthlyFee == null || monthlyFee.compareTo(BigDecimal.ZERO) <= 0) {
            if (contract.getUnit() != null && contract.getUnit().getEffectiveBasePrice() != null) {
                monthlyFee = contract.getUnit().getEffectiveBasePrice();
            } else if (contract.getBooking() != null && contract.getBooking().getTotalRentalFee() != null) {
                monthlyFee = contract.getBooking().getTotalRentalFee();
            } else {
                monthlyFee = BigDecimal.ZERO;
            }
        }

        // Đơn giá thuê 1 ngày làm tròn lên tiền chẵn nghìn (VND)
        // Ví dụ: 3.500.000 / 30 = 116.666,666... -> làm tròn lên thành 117.000 đ/ngày
        BigDecimal dailyRentalPrice = monthlyFee.compareTo(BigDecimal.ZERO) > 0
                ? roundUpToThousand(monthlyFee.divide(BigDecimal.valueOf(30), 4, java.math.RoundingMode.HALF_UP))
                : BigDecimal.ZERO;

        BigDecimal depositHeld = contract.getDepositHeld() != null
                ? contract.getDepositHeld()
                : (contract.getBooking() != null && contract.getBooking().getDepositPaid() != null
                    ? contract.getBooking().getDepositPaid()
                    : (contract.getBooking() != null && contract.getBooking().getDepositAmount() != null
                        ? contract.getBooking().getDepositAmount()
                        : BigDecimal.ZERO));

        // Check for paid and unverified payments
        BigDecimal paidTowardsDebt = BigDecimal.ZERO;
        BigDecimal unverifiedAmount = BigDecimal.ZERO;
        try {
            if (contract.getId() != null) {
                List<Payment> contractPayments = paymentRepository.findByContract_Id(contract.getId());
                for (Payment p : contractPayments) {
                    if (p.getPaymentType() == PaymentType.DEPOSIT) {
                        continue;
                    }
                    if (p.getPaymentTime() != null && dueDate != null && p.getPaymentTime().toLocalDate().isBefore(dueDate)) {
                        continue;
                    }
                    if (p.getStatus() == PaymentStatus.PAID && p.getAmount() != null) {
                        paidTowardsDebt = paidTowardsDebt.add(p.getAmount());
                    } else if (p.getStatus() == PaymentStatus.PENDING && p.getAmount() != null) {
                        unverifiedAmount = unverifiedAmount.add(p.getAmount());
                    }
                }
            }
            if (contract.getBooking() != null && contract.getBooking().getId() != null) {
                List<Payment> bookingPayments = paymentRepository.findAllByBooking_Id(contract.getBooking().getId());
                for (Payment p : bookingPayments) {
                    if (p.getContract() != null && contract.getId() != null && contract.getId().equals(p.getContract().getId())) {
                        continue;
                    }
                    if (p.getPaymentType() == PaymentType.DEPOSIT) {
                        continue;
                    }
                    if (p.getPaymentTime() != null && dueDate != null && p.getPaymentTime().toLocalDate().isBefore(dueDate)) {
                        continue;
                    }
                    if (p.getStatus() == PaymentStatus.PAID && p.getAmount() != null) {
                        paidTowardsDebt = paidTowardsDebt.add(p.getAmount());
                    } else if (p.getStatus() == PaymentStatus.PENDING && p.getAmount() != null) {
                        unverifiedAmount = unverifiedAmount.add(p.getAmount());
                    }
                }
            }
        } catch (Exception e) {
            log.debug("No payment check available: {}", e.getMessage());
        }

        if (!policyValid) {
            return new CalculationResult(
                    overdueDays,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    depositHeld,
                    depositHeld,
                    unverifiedAmount,
                    OverdueStage.POLICY_UNCONFIGURED,
                    false,
                    "Cơ sở chưa có chính sách quá hạn được kích hoạt hoặc tham số chính sách không hợp lệ.",
                    dueDate,
                    today,
                    "Không thể tính phí: Thiếu chính sách cơ sở hợp lệ (Group 5)",
                    unitTypeName,
                    monthlyFee,
                    dailyRentalPrice,
                    BigDecimal.valueOf(100)
            );
        }

        int graceDays = policy.getOverdueGraceDays();
        int disableDays = policy.getOverdueAccessDisableDays();
        int sealingDays = policy.getOverdueSealingDays();

        // Tỷ lệ % phí phạt trễ hạn từ chính sách cơ sở (tạm thời áp dụng toàn chi nhánh là 100%)
        BigDecimal lateFeePercentage = BigDecimal.valueOf(100);
        if (policy.getDailyLateFee() != null) {
            if (policy.getDailyLateFee().compareTo(BigDecimal.valueOf(500)) <= 0
                    && policy.getDailyLateFee().compareTo(BigDecimal.ZERO) >= 0) {
                lateFeePercentage = policy.getDailyLateFee();
            }
        }

        // Đơn giá phạt trễ 1 ngày: Đơn giá ngày của loại kho * (Tỷ lệ % / 100), làm tròn lên tiền chẵn nghìn (VND)
        BigDecimal dailyRate;
        if (dailyRentalPrice.compareTo(BigDecimal.ZERO) > 0) {
            dailyRate = roundUpToThousand(
                    dailyRentalPrice.multiply(lateFeePercentage)
                            .divide(BigDecimal.valueOf(100), 4, java.math.RoundingMode.HALF_UP)
            );
        } else if (policy.getDailyLateFee() != null && policy.getDailyLateFee().compareTo(BigDecimal.valueOf(500)) > 0) {
            dailyRate = roundUpToThousand(policy.getDailyLateFee());
        } else {
            dailyRate = BigDecimal.ZERO;
        }

        long billableDays = Math.max(0, overdueDays - graceDays);
        BigDecimal grossLateFee = dailyRate.multiply(BigDecimal.valueOf(billableDays));
        BigDecimal netLateFee = roundUpToThousand(grossLateFee.subtract(paidTowardsDebt).max(BigDecimal.ZERO));

        // Xử lý trường hợp khách trả kho muộn:
        // Cấn trừ tiền phạt vào tiền cọc giữ:
        // - Số tiền hoàn khách = tiền cọc - tiền phí phạt (khi cọc >= phạt)
        // - Chỉ khi tiền cọc - phí phạt < 0 thì chuyển thành Tổng công nợ = tiền phí phạt - tiền cọc (khách phải nộp thêm cho Boxora)
        BigDecimal balance = depositHeld.subtract(netLateFee);
        BigDecimal customerRefundAmount;
        BigDecimal totalDebt;

        if (balance.compareTo(BigDecimal.ZERO) >= 0) {
            customerRefundAmount = balance;
            totalDebt = BigDecimal.ZERO;
        } else {
            customerRefundAmount = BigDecimal.ZERO;
            totalDebt = balance.negate();
        }

        OverdueStage stage;
        if (overdueDays <= graceDays) {
            stage = OverdueStage.GRACE_PERIOD;
        } else if (overdueDays < disableDays) {
            stage = OverdueStage.WARNING;
        } else if (overdueDays < sealingDays) {
            stage = OverdueStage.PIN_REVOCATION;
        } else {
            stage = OverdueStage.SEALING_ELIGIBLE;
        }

        String formulaExplanation;
        if (balance.compareTo(BigDecimal.ZERO) >= 0) {
            formulaExplanation = String.format(
                    "Phí phạt (%s: %,.0f đ/tháng -> %,.0f đ/ngày × %.0f%%) = max(0, %d ngày quá hạn - %d ngày ân hạn) × %,.0f đ/ngày = %,.0f đ. Tiền cọc giữ: %,.0f đ -> Số tiền hoàn khách = %,.0f đ - %,.0f đ = %,.0f đ%s",
                    unitTypeName, monthlyFee.doubleValue(), dailyRentalPrice.doubleValue(), lateFeePercentage.doubleValue(),
                    overdueDays, graceDays, dailyRate.doubleValue(), netLateFee.doubleValue(),
                    depositHeld.doubleValue(), depositHeld.doubleValue(), netLateFee.doubleValue(), customerRefundAmount.doubleValue(),
                    paidTowardsDebt.compareTo(BigDecimal.ZERO) > 0 ? String.format(" (Đã thanh toán: %,.0f đ)", paidTowardsDebt.doubleValue()) : ""
            );
        } else {
            formulaExplanation = String.format(
                    "Phí phạt (%s: %,.0f đ/tháng -> %,.0f đ/ngày × %.0f%%) = max(0, %d ngày quá hạn - %d ngày ân hạn) × %,.0f đ/ngày = %,.0f đ. Tiền cọc giữ: %,.0f đ -> Tổng công nợ khách phải nộp = %,.0f đ - %,.0f đ = %,.0f đ%s",
                    unitTypeName, monthlyFee.doubleValue(), dailyRentalPrice.doubleValue(), lateFeePercentage.doubleValue(),
                    overdueDays, graceDays, dailyRate.doubleValue(), netLateFee.doubleValue(),
                    depositHeld.doubleValue(), netLateFee.doubleValue(), depositHeld.doubleValue(), totalDebt.doubleValue(),
                    paidTowardsDebt.compareTo(BigDecimal.ZERO) > 0 ? String.format(" (Đã thanh toán: %,.0f đ)", paidTowardsDebt.doubleValue()) : ""
            );
        }

        return new CalculationResult(
                overdueDays,
                BigDecimal.ZERO,
                dailyRate,
                netLateFee,
                totalDebt,
                customerRefundAmount,
                depositHeld,
                unverifiedAmount,
                stage,
                true,
                null,
                dueDate,
                today,
                formulaExplanation,
                unitTypeName,
                monthlyFee,
                dailyRentalPrice,
                lateFeePercentage
        );
    }

    @Override
    public boolean isPolicyValid(FacilityPolicy policy) {
        if (policy == null || Boolean.FALSE.equals(policy.getIsActive())) {
            return false;
        }
        if (policy.getOverdueGraceDays() == null || policy.getOverdueGraceDays() < 0) {
            return false;
        }
        if (policy.getDailyLateFee() == null || policy.getDailyLateFee().compareTo(BigDecimal.ZERO) < 0) {
            return false;
        }
        if (policy.getOverdueAccessDisableDays() == null || policy.getOverdueAccessDisableDays() < 0) {
            return false;
        }
        if (policy.getOverdueAccessDisableDays() <= policy.getOverdueGraceDays()) {
            return false;
        }
        if (policy.getOverdueSealingDays() == null || policy.getOverdueSealingDays() < 0) {
            return false;
        }
        if (policy.getOverdueSealingDays() < policy.getOverdueAccessDisableDays()) {
            return false;
        }
        return true;
    }
}
