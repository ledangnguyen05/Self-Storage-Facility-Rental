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

import java.util.List;

@RestController
@RequestMapping("/api/v1/geocoding")
@Tag(name = "Geocoding", description = "API tìm kiếm và phân giải tọa độ GPS địa chỉ Việt Nam")
@RequiredArgsConstructor
@Slf4j
public class GeocodingController {

    private final GeocodingService geocodingService;

    @PostMapping("/search")
    @Operation(summary = "Tìm danh sách tọa độ GPS theo tên địa chỉ")
    public ResponseEntity<ApiResponse<List<GeocodeResponse>>> search(
            @Valid @RequestBody GeocodeRequest request
    ) {
        List<GeocodeResponse> response = geocodingService.geocode(request);
        return ResponseEntity.ok(ApiResponse.success("Tìm thấy danh sách tọa độ thành công", response));
    }
}
