package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeocodeRequest {

    @NotBlank(message = "Địa chỉ tìm kiếm không được để trống")
    private String query;

    private String cityHint;
}
