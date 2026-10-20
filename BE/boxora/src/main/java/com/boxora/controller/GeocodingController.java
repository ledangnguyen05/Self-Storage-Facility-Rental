package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.GeocodeRequest;
import com.boxora.dto.response.GeocodeResponse;
import com.boxora.service.GeocodingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/geocoding")
@Tag(name = "Geocoding", description = "API tìm kiếm và phân giải tọa độ GPS địa chỉ Việt Nam")
@RequiredArgsConstructor
@Slf4j
public class GeocodingController {

    private final GeocodingService geocodingService;

    @PostMapping("/search")
    @Operation(summary = "Tìm tọa độ GPS theo tên địa chỉ")
    public ResponseEntity<ApiResponse<GeocodeResponse>> search(
            @Valid @RequestBody GeocodeRequest request
    ) {
        GeocodeResponse response = geocodingService.geocode(request);
        if (response == null) {
            return ResponseEntity.ok(ApiResponse.error("Không tìm thấy tọa độ phù hợp cho địa chỉ này"));
        }
        return ResponseEntity.ok(ApiResponse.success("Tìm thấy tọa độ GPS thành công", response));
    }
}
