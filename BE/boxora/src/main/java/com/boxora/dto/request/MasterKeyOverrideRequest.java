package com.boxora.dto.request;

import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.OverrideSeverity;
import jakarta.validation.constraints.*;
import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterKeyOverrideRequest {

    @NotNull(message = "Vui lòng chọn cơ sở")
    private UUID facilityId;

    @NotNull(message = "Vui lòng chọn loại tình huống")
    private MasterKeyOverrideCategory category;

    @NotNull(message = "Vui lòng chọn mức độ khẩn cấp")
    private OverrideSeverity severity;

    @NotNull(message = "Vui lòng chọn người chứng kiến")
    private UUID witnessUserId;

    @NotBlank(message = "Người chứng kiến cần nhập mật khẩu của mình để xác nhận")
    private String witnessPassword;

    @NotBlank(message = "Vui lòng nhập lý do sử dụng chìa khóa tổng")
    @Size(max = 500, message = "Lý do tối đa 500 ký tự")
    private String reason;

    @Size(max = 100, message = "Số văn bản tham chiếu tối đa 100 ký tự")
    private String documentReference;

    // optional - what the override was used to access (e.g., STORAGE_UNIT)
    private String resourceType;
    private UUID resourceId;
}