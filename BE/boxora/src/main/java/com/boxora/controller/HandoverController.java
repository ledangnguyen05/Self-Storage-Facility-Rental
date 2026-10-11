package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.service.HandoverService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/handovers")
@Tag(name = "Handover & Check-in", description = "API quản lý bàn giao kho, kiểm tra 4 điều kiện check-in (BR-RULE-005) và gán kho (BR-RULE-006)")
@RequiredArgsConstructor
public class HandoverController {

    private final HandoverService handoverService;

    @GetMapping("/booking/{bookingId}/prerequisites")
    @Operation(summary = "Đối soát 4 điều kiện tiên quyết trước khi check-in bàn giao (BR-RULE-005: Cọc + Tiền thuê tháng đầu + Ký hợp đồng + Đối soát CCCD)")
    public ResponseEntity<ApiResponse<HandoverPrerequisitesResponse>> getCheckInPrerequisites(@PathVariable UUID bookingId) {
        HandoverPrerequisitesResponse response = handoverService.getCheckInPrerequisites(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Kiểm tra 4 điều kiện bàn giao thành công", response));
    }

    @PostMapping("/check-in")
    @Operation(summary = "Thực hiện check-in bàn giao kho vật lý (BR-RULE-005/006: yêu cầu đủ 4 điều kiện, cấp PIN SmartLock và chuyển trạng thái kho sang OCCUPIED)")
    public ResponseEntity<ApiResponse<HandoverResponse>> checkIn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Check-in bàn giao kho thành công và kích hoạt mã khóa SmartLock", handoverService.checkIn(request)));
    }

    @PostMapping("/return")
    @Operation(summary = "Xử lý trả kho và hoàn cọc")
    public ResponseEntity<ApiResponse<HandoverResponse>> processReturn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Nghiệm thu hoàn trả kho và quyết toán cọc thành công", handoverService.processReturn(request)));
    }

    @GetMapping("/booking/{bookingId}")
    @Operation(summary = "Lấy lịch sử các biên bản bàn giao của đơn đặt kho")
    public ResponseEntity<ApiResponse<List<HandoverResponse>>> getByBookingId(@PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success(handoverService.getByBookingId(bookingId)));
    }
}
