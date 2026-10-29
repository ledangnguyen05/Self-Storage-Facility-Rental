/**
 * Boxora Smart Storage AI Assistant Service
 * Secure Backend-proxied client communicating with Spring Boot /api/v1/chatbot/chat
 * Gemini credentials are used only by the backend.
 */

import { api } from '../lib/axios'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

export const BOXORA_KNOWLEDGE_BASE = `
🏢 THÔNG TIN HỆ THỐNG KHO TỰ QUẢN THÔNG MINH BOXORA:
Boxora là nền tảng cho thuê kho mini tự quản, kho cá nhân, kho gia đình và kho thương mại điện tử tích hợp công nghệ Smart Lock (mã PIN bảo mật cá nhân), camera an ninh AI 24/7 và kiểm soát nhiệt ẩm.

📍 DANH SÁCH 4 CHI NHÁNH CHÍNH THỨC TẠI TP. HỒ CHÍ MINH:
1. Boxora Quận 1 (Mã: HCM-D1): 123 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP.HCM. Hotline: 0901234567 | Email: boxoradistrict1@gmail.com. Mở cửa: 08:00 - 20:00.
2. Boxora Quận 7 (Mã: HCM-D7): 456 Nguyễn Hữu Thọ, P. Tân Hưng, Quận 7, TP.HCM. Hotline: 0902345678 | Email: boxoradistrict7@gmail.com. Mở cửa: 08:00 - 20:00.
3. Boxora Thủ Đức (Mã: HCM-TD): 789 Võ Văn Ngân, P. Linh Chiểu, TP. Thủ Đức, TP.HCM. Hotline: 0903456789 | Email: boxorathuduc@gmail.com. Mở cửa: 08:00 - 20:00.
4. Boxora Tân Bình Mega Hub (Mã: HCM-TB): 102 Trường Sơn, P. 2, Q. Tân Bình, TP.HCM. Hotline: 0904567890 | Email: tanbinh@boxora.vn. Mở cửa: 08:00 - 21:00.

📦 BẢNG GIÁ VÀ 5 LOẠI KHO THỰC TẾ:
1. Mini (tủ cá nhân):
   - Kích thước: 1.0m x 1.0m x 1.2m | Diện tích: 1.0 m² | Thể tích: 1.2 m³.
   - Giá thuê: 450.000đ/tháng | Tiền cọc: 450.000đ.
   - Thích hợp: Balo, vali du lịch, hồ sơ tài liệu, laptop, đồ công nghệ cá nhân.
2. Vừa (phòng studio nhỏ):
   - Kích thước: 1.5m x 2.0m x 2.6m | Diện tích: 3.0 m² | Thể tích: 7.8 m³.
   - Giá thuê: 1.250.000đ/tháng | Tiền cọc: 1.250.000đ.
   - Thích hợp: Đồ dùng sinh viên, cá nhân chuyển trọ, xe đạp, quạt, bàn ghế xếp, vali lớn.
3. Tiêu chuẩn (căn một phòng ngủ):
   - Kích thước: 2.0m x 3.0m x 2.8m | Diện tích: 6.0 m² | Thể tích: 16.8 m³.
   - Giá thuê: 2.400.000đ/tháng | Tiền cọc: 2.400.000đ.
   - Thích hợp: Toàn bộ nội thất căn hộ 1-2 phòng ngủ khi chuyển nhà, sửa nhà (giường, nệm, tủ, sofa, tủ lạnh, máy giặt).
4. Kho lạnh (kiểm soát nhiệt độ 18°C - 22°C):
   - Kích thước: 2.0m x 2.5m x 2.8m | Diện tích: 5.0 m² | Thể tích: 14.0 m³.
   - Giá thuê: 3.200.000đ/tháng | Tiền cọc: 3.200.000đ.
   - Thích hợp: Rượu vang, mỹ phẩm cao cấp, đồ da hàng hiệu, linh kiện điện tử, dược phẩm, hồ sơ chống ẩm mốc.
5. Rất lớn (văn phòng thương mại):
   - Kích thước: 3.0m x 4.0m x 3.0m | Diện tích: 12.0 m² | Thể tích: 36.0 m³.
   - Giá thuê: 4.800.000đ/tháng | Tiền cọc: 4.800.000đ.
   - Thích hợp: Hàng hóa kinh doanh online, thiết bị livestream, hàng pallet, vật tư doanh nghiệp.

💳 CHÍNH SÁCH THANH TOÁN, CỌC, HOÀN HỦY & GIA HẠN:
- Thanh toán 100% online: Qua cổng VNPay (VietQR, thẻ ATM nội địa, thẻ Visa/MasterCard). Boxora hiện không thu tiền mặt tại quầy để đảm bảo an toàn và tự động hóa.
- Tiền cọc: Bằng 100% giá thuê 1 tháng (ví dụ kho 450.000đ thì cọc 450.000đ). Cọc được hoàn lại 100% khi kết thúc hợp đồng và bàn giao kho nguyên vẹn.
- Thời hạn thuê tối thiểu: 1 tháng.
- Thời hạn giữ chỗ: Tối đa 14 ngày trước ngày bắt đầu thuê; thời hạn thanh toán giữ chỗ 1 giờ.
- Chính sách hủy & hoàn tiền:
  + Hủy trước 24 giờ so với giờ hẹn check-in: Hoàn 100% tiền cọc và tiền thuê.
  + Hủy trong vòng 48 giờ: Hoàn 70% tiền cọc.
- Chính sách trả kho và hoàn cọc: Trả kho trực tuyến tại [Cổng khách hàng](/customer), nhân viên kiểm tra kho không hư hại, tiền cọc hoàn lại trong vòng 5 ngày làm việc (SLA 5 ngày).
- Gia hạn hợp đồng: Mở cổng gia hạn trước 3 ngày trước khi hết hạn hợp đồng.
- Xử lý trễ hạn & Nợ: Ân hạn 1 ngày; phí trễ hạn 50.000đ/ngày. Sau 3 ngày nợ sẽ tạm khóa mã PIN mở kho. Sau 7 ngày nợ quá hạn sẽ tiến hành niêm phong kho vật lý theo quy định.

🚀 QUY TRÌNH THUÊ VÀ SỬ DỤNG KHO:
1. Đặt kho online: Chọn chi nhánh, loại kho, ngày thuê tại [Khám phá kho](/units).
2. Thanh toán trực tuyến: Thanh toán tiền thuê và cọc qua VNPay (VietQR/Thẻ).
3. Nhận Mã PIN Smart Lock: Ký hợp đồng điện tử và nhận mã PIN truy cập ngay tại [Cổng Khách Hàng](/customer).
4. Bàn giao nhận kho: Đến chi nhánh theo lịch hẹn, nhân viên đối soát CCCD và bàn giao kho. Khách hàng sử dụng mã PIN để ra vào kho tự quản 24/7.

🔗 CÁC LIÊN KẾT ĐIỀU HƯỚNG TRÊN HỆ THỐNG:
- [Khám phá & Đặt kho](/units)
- [Cổng khách hàng (Xem mã PIN & Quản lý kho)](/customer)
- [Đăng nhập](/login)
- [Đăng ký tài khoản](/register)
- [Quy định & Tiêu chuẩn](/terms)
- [Trung tâm hỗ trợ](/support)
`

export const QUICK_SUGGESTIONS = [
  'Bảng giá và các loại kho tại Boxora',
  'Địa chỉ 4 chi nhánh Boxora tại TP.HCM',
  'Quy trình thanh toán online và nhận mã PIN mở kho',
  'Chính sách hoàn cọc và hủy hợp đồng thế nào?',
  'Kho lạnh kiểm soát nhiệt độ bảo quản những gì?',
  'Thủ tục gia hạn và trả kho trực tuyến'
]

export async function sendChatMessage(
  messages: ChatMessage[],
  signal?: AbortSignal,
  unavailableMessage = 'Boxora AI hiện tạm thời không khả dụng. Vui lòng thử lại sau hoặc tham khảo các loại kho tại /units.'
): Promise<string> {
  const lastMessage = messages[messages.length - 1]?.content || ''
  const rawHistory = messages.slice(0, messages.length - 1).map(msg => ({
    role: msg.role,
    content: msg.content
  }))

  // Inject system knowledge base into context history so Gemini AI always uses the newest verified data
  const systemContextIntro = {
    role: 'user',
    content: `[DỮ LIỆU HỆ THỐNG BOXORA MỚI NHẤT NĂM 2026 - BẮT BUỘC DÙNG ĐỂ TƯ VẤN]:\n${BOXORA_KNOWLEDGE_BASE}`
  }
  const systemContextAck = {
    role: 'assistant',
    content: 'Tôi đã tiếp nhận toàn bộ dữ liệu mới nhất của Boxora: 4 chi nhánh thực tế tại TP.HCM (Quận 1, Quận 7, Thủ Đức, Tân Bình), bảng giá 5 loại kho từ 450k/tháng, thanh toán online 100% qua VNPay, cọc 100%, chính sách hoàn cọc 5 ngày và mã PIN SmartLock tại Cổng khách hàng. Tôi sẵn sàng hỗ trợ khách hàng chính xác nhất!'
  }

  const history = [
    systemContextIntro,
    systemContextAck,
    ...rawHistory.slice(-6)
  ]

  try {
    const response = await api.post(
      '/api/v1/chatbot/chat',
      {
        message: lastMessage,
        history
      },
      { signal }
    )

    const status = response.data?.data?.status
    if (status === 'UNAVAILABLE' || status === 'CONFIGURATION_ERROR') {
      return unavailableMessage
    }

    const reply = response.data?.data?.reply
    if (reply) {
      return reply
    }
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') {
      throw err
    }
    console.warn('Boxora AI backend is unavailable')
  }

  // Graceful fallback response if backend encounters high load
  return unavailableMessage
}
