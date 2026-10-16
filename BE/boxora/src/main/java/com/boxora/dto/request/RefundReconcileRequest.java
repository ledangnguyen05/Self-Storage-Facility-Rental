package com.boxora.dto.request;

import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundReconcileRequest {

    @Size(max = 500, message = "Ghi chú đối soát không được quá 500 ký tự")
    private String reconciliationNotes;
}
