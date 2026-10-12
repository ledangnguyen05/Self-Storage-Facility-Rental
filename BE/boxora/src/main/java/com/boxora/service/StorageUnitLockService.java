package com.boxora.service;

import java.util.UUID;

public interface StorageUnitLockService {

    /**
     * Thử giữ soft-lock trên ngăn kho trong khoảng thời gian quy định (mặc định 24 giờ).
     * @param unitId ID ngăn kho cần lock
     * @param bookingId ID đơn đặt kho giữ lock
     * @param timeoutHours Số giờ soft-lock (mặc định 24h)
     * @return true nếu giữ lock thành công, false nếu ngăn kho đang bị người khác lock
     */
    boolean tryLockUnit(UUID unitId, UUID bookingId, long timeoutHours);

    /**
     * Kiểm tra xem ngăn kho có đang bị soft-lock trong 24h hay không.
     */
    boolean isUnitLocked(UUID unitId);

    /**
     * Giải phóng soft-lock của ngăn kho (khi booking bị hủy, hết hạn hoặc hoàn tất thanh toán).
     */
    void releaseLock(UUID unitId);

    /**
     * Lấy ID booking đang giữ soft-lock ngăn kho (nếu có).
     */
    String getLockHolder(UUID unitId);
}

