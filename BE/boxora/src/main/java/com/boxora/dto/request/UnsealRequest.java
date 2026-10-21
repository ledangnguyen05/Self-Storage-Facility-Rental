package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** Legacy body of POST /sealing-records/{id}/unseal; prefer {@link SealingUnsealRequest} on /sealing/{id}/unseal. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu gỡ niêm phong kho (đường dẫn cũ /sealing-records)")
public class UnsealRequest {

    @NotBlank(message = "Vui lòng nhập lý do gỡ niêm phong")
    @Size(max = 500, message = "Lý do gỡ niêm phong tối đa 500 ký tự")
    private String unsealReason;

    /** Ignored; kept so older clients still deserialize. */
    private UUID witnessId;

    /** Ignored; kept so older clients still deserialize. */
    private String photoEvidenceUrl;

    @Size(max = 1000, message = "Ghi chú tối đa 1000 ký tự")
    private String notes;
}
