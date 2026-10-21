package com.boxora.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileSignRequest {

    /** Stored paths such as /uploads/handover/9f1c.jpg, exactly as the API returned them on the records. */
    @NotEmpty(message = "Danh sách tệp không được để trống")
    @Size(max = 50, message = "Chỉ ký tối đa 50 tệp mỗi lần")
    private List<String> urls;
}
