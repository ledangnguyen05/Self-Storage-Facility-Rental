package com.boxora.mapper;

import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.entity.ContractRenewal;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Mapper(componentModel = "spring")
public interface ContractRenewalMapper {

    DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Mapping(source = "contract.id", target = "contractId")
    @Mapping(source = "contract.contractCode", target = "contractCode")
    @Mapping(source = "contract.customer.id", target = "customerId")
    @Mapping(source = "contract.customer.fullName", target = "customerName")
    @Mapping(source = "contract.customer.email", target = "customerEmail")
    @Mapping(source = "contract.facility.id", target = "facilityId")
    @Mapping(source = "contract.facility.name", target = "facilityName")
    @Mapping(source = "contract.unit.unitCode", target = "unitCode")
    @Mapping(source = "payment.id", target = "paymentId")
    @Mapping(source = "payment.status", target = "paymentStatus")
    @Mapping(source = "reviewedBy.id", target = "reviewedById")
    @Mapping(source = "reviewedBy.fullName", target = "reviewedByName")
    @Mapping(source = "cashierStaff.fullName", target = "cashierStaffName")
    @Mapping(source = "assignedStaff.id", target = "assignedStaffId")
    @Mapping(source = "assignedStaff.fullName", target = "assignedStaffName")
    @Mapping(source = "assignedStaff.email", target = "assignedStaffEmail")
    @Mapping(source = "handledBy.id", target = "handledById")
    @Mapping(source = "handledBy.fullName", target = "handledByName")
    @Mapping(target = "signingUrl", ignore = true)
    ContractRenewalResponse toResponse(ContractRenewal entity);

    @AfterMapping
    default void enrichCheckInTimeStatus(ContractRenewal entity, @MappingTarget ContractRenewalResponse response) {
        if (entity == null || response == null) return;

        // Quy tắc nghiệp vụ thời điểm check-in (Lịch hẹn tiếp đón):
        // 1. Chưa đến ngày check-in -> Không cho phép -> Hiển thị thời điểm được phép nhận kho
        // 2. Đúng ngày nhưng chưa đến giờ check-in -> Không cho phép -> Chờ đến giờ hợp lệ
        // 3. Đã đến giờ check-in -> Có thể -> Kiểm tra các điều kiện bàn giao còn lại
        // 4. Khách đến muộn -> Có thể -> Cho bàn giao nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ
        if (entity.getCounterAppointmentDate() != null) {
            LocalDate apptDate = entity.getCounterAppointmentDate();
            LocalDateTime now = LocalDateTime.now(BUSINESS_ZONE);
            LocalDate today = now.toLocalDate();

            if (today.isBefore(apptDate)) {
                String timeSuffix = (entity.getCounterAppointmentTime() != null && !entity.getCounterAppointmentTime().isBlank())
                        ? " lúc " + entity.getCounterAppointmentTime() : "";
                response.setCheckInTimeMet(false);
                response.setCheckInTimeStatus("BEFORE_DATE");
                response.setCheckInTimeMessage(String.format("Chưa đến ngày check-in. Thời điểm được phép tiếp nhận từ: %s%s",
                        apptDate.format(DATE_FMT), timeSuffix));
            } else if (today.isEqual(apptDate) && entity.getCounterAppointmentTime() != null && !entity.getCounterAppointmentTime().isBlank()) {
                try {
                    LocalTime apptTime = LocalTime.parse(entity.getCounterAppointmentTime().trim());
                    if (now.toLocalTime().isBefore(apptTime)) {
                        response.setCheckInTimeMet(false);
                        response.setCheckInTimeStatus("BEFORE_TIME");
                        response.setCheckInTimeMessage(String.format("Đúng ngày nhưng chưa đến giờ check-in (Lịch hẹn lúc %s). Vui lòng chờ đến giờ hợp lệ.",
                                entity.getCounterAppointmentTime()));
                    } else {
                        response.setCheckInTimeMet(true);
                        response.setCheckInTimeStatus("ON_TIME");
                        response.setCheckInTimeMessage("Đã đến giờ check-in. Vui lòng kiểm tra các điều kiện bàn giao còn lại.");
                    }
                } catch (Exception ex) {
                    response.setCheckInTimeMet(true);
                    response.setCheckInTimeStatus("ON_TIME");
                    response.setCheckInTimeMessage("Đã đến giờ check-in hợp lệ");
                }
            } else if (today.isEqual(apptDate)) {
                response.setCheckInTimeMet(true);
                response.setCheckInTimeStatus("ON_TIME");
                response.setCheckInTimeMessage("Đúng ngày hẹn check-in hợp lệ");
            } else {
                response.setCheckInTimeMet(true);
                response.setCheckInTimeStatus("LATE");
                response.setCheckInTimeMessage(String.format("Khách đến muộn so với lịch hẹn (%s). Cho phép bàn giao nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ.",
                        apptDate.format(DATE_FMT)));
            }
        } else {
            response.setCheckInTimeMet(true);
            response.setCheckInTimeStatus("ON_TIME");
            response.setCheckInTimeMessage("Trực tuyến / Không yêu cầu tiếp đón tại quầy");
        }
    }
}
