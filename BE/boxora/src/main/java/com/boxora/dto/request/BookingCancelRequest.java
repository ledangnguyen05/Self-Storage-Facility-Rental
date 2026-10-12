package com.boxora.dto.request;

import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingCancelRequest {

    @Size(max = 500, message = "Lý do hủy đơn không được vượt quá 500 ký tự")
    private String cancellationReason;
}

