package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.StaffAssignmentCreateRequest;
import com.boxora.dto.request.StaffAssignmentStatusUpdateRequest;
import com.boxora.dto.request.StaffAssignmentUpdateRequest;
import com.boxora.dto.response.StaffAssignmentResponse;
import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.enums.StaffShift;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface StaffAssignmentService {

    /**
     * Phân công ca trực cho nhân viên tại cơ sở.
     */
    StaffAssignmentResponse createAssignment(StaffAssignmentCreateRequest request);

    /**
     * Cập nhật thông tin phân công ca trực (ca, khu vực, vai trò, ghi chú).
     */
    StaffAssignmentResponse updateAssignment(UUID id, StaffAssignmentUpdateRequest request);

    /**
     * Cập nhật nhanh trạng thái ca trực (Check-in, Hoàn thành, Vắng mặt).
     */
    StaffAssignmentResponse updateStatus(UUID id, StaffAssignmentStatusUpdateRequest request);

    /**
     * Hủy / xóa phân công ca trực.
     */
    void deleteAssignment(UUID id);

    /**
     * Lấy chi tiết một lượt phân công ca trực.
     */
    StaffAssignmentResponse getById(UUID id);

    /**
     * Danh sách phân công ca trực theo bộ lọc phân trang (phù hợp quản lý ca làm việc).
     */
    PageResponse<StaffAssignmentResponse> getAllAssignments(
            UUID facilityId,
            UUID staffId,
            LocalDate assignedDate,
            StaffShift shift,
            StaffAssignmentStatus status,
            LocalDate fromDate,
            LocalDate toDate,
            int page,
            int size,
            String sortBy,
            String sortDir
    );

    /**
     * Bảng phân công ca trực trong ngày của cơ sở (Daily Task Board - SP2-06).
     */
    List<StaffAssignmentResponse> getDailyBoard(UUID facilityId, LocalDate date);
}
