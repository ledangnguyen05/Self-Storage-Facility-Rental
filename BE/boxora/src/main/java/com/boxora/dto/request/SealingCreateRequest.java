package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

/** Sealing protocol of an overdue unit. Either the contract or the unit identifies it; the contract wins. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SealingCreateRequest {

    private UUID contractId;

    private UUID unitId;

    /** Number printed on the physical seal tag. Blank: the system issues one to write on the tag. */
    @Size(max = 50, message = "Số tem niêm phong tối đa 50 ký tự")
    private String sealTagNumber;

    /** Staff or manager of the same facility who witnessed the sealing on site. */
    @NotNull(message = "Vui lòng chọn người chứng kiến tại hiện trường")
    private UUID witnessId;

    @Size(max = 500, message = "Lý do niêm phong tối đa 500 ký tự")
    private String reason;

    @Size(max = 4000, message = "Mô tả hàng hóa tối đa 4000 ký tự")
    private String inventorySummary;

    @Size(max = 2000, message = "Ghi chú tối đa 2000 ký tự")
    private String notes;

    private String evidenceUrls;
}
