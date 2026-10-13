package com.boxora.enums;

public enum MasterKeyOverrideCategory {
    LIFE_AND_SAFETY,       // Cháy nổ, cứu nạn, rò rỉ khí/nước, nguy hiểm đến tính mạng hoặc an toàn cơ sở
    LAW_ENFORCEMENT,       // Yêu cầu pháp lý, lệnh khám xét của công an, điều tra của tòa án
    POLICY_ENFORCEMENT,    // Xử lý vi phạm hợp đồng, niêm phong tài sản quá hạn (+7 ngày theo BR-RULE-012)
    TECHNICAL_INCIDENT,    // Sự cố kỹ thuật (hỏng mạch điện tử smart lock, kẹt cơ khí, mất nguồn pin)
    SPECIAL_CIRCUMSTANCE   // Tình huống đặc thù / ngoại lệ phát sinh khác
}
