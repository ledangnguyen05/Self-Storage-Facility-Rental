export interface DispatchedEmail {
  id: string
  to: string
  recipientName: string
  bookingCode: string
  type: 'CONFIRMED' | 'REJECTED'
  subject: string
  body: string
  sentAt: string
  facilityName: string
  status: 'SENT' | 'DELIVERED'
  rejectionReason?: string
}

export const reservationEmailService = {
  // Lấy đơn theo mã đặt chỗ
  getReservationByCode(code: string): any | null {
    if (!code) return null
    try {
      const raw = localStorage.getItem('boxora_guest_reservations')
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) {
          return list.find((r: any) => r.bookingCode === code || r.id === code || r.id === `LOCAL-RES-${code}`) || null
        }
      }
    } catch (e) {
      console.warn('Error reading reservation by code:', e)
    }
    return null
  },

  // Lấy lịch sử email đã gửi
  getDispatchedEmails(): DispatchedEmail[] {
    try {
      const raw = localStorage.getItem('boxora_sent_emails')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  // 1. Thao tác Xác nhận đơn của nhân viên: Chuyển sang "Chờ check in" và gửi email
  confirmReservation(
    bookingCode: string,
    staffUser?: { id?: string; fullName?: string }
  ): { success: boolean; email?: DispatchedEmail; message: string; updatedReservation?: any } {
    try {
      const raw = localStorage.getItem('boxora_guest_reservations')
      let list: any[] = raw ? JSON.parse(raw) : []
      const index = list.findIndex(r => r.bookingCode === bookingCode || r.id === bookingCode)

      let resObj = index !== -1 ? list[index] : null
      const nowIso = new Date().toISOString()
      const nowTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN')

      const updatedRes = {
        ...(resObj || {}),
        bookingCode,
        status: 'CONFIRMED', // Chuyển sang "Chờ check in"
        confirmedByStaffId: staffUser?.id || 'staff',
        confirmedByStaffName: staffUser?.fullName || 'Nhân viên trực ca Boxora',
        confirmedAt: nowIso,
      }

      if (index !== -1) {
        list[index] = updatedRes
      } else {
        list.unshift(updatedRes)
      }
      localStorage.setItem('boxora_guest_reservations', JSON.stringify(list))

      // Tạo email gửi cho khách hàng
      const recipientEmail = updatedRes.customerEmail || updatedRes.customer?.email || 'customer@boxora.vn'
      const customerName = updatedRes.customerName || updatedRes.customer?.fullName || 'Quý khách'
      const facilityName = updatedRes.facilityName || updatedRes.facility?.name || 'Cơ sở Boxora'
      const checkInDate = updatedRes.checkInDate || 'theo lịch hẹn'
      const checkInTime = updatedRes.checkInTime || 'giờ tiếp đón'
      const idCard = updatedRes.identityCardNumber || updatedRes.customer?.idCard || 'CCCD'

      const emailSubject = `[BOXORA] Xác nhận đơn giữ chỗ ${bookingCode} - Chờ check-in tại cơ sở`
      const emailBody = `Kính gửi Quý khách ${customerName},

Nhân viên CSKH tại ${facilityName} đã liên hệ và xác nhận thành công đơn đặt giữ chỗ của Quý khách.

THÔNG TIN ĐƠN ĐẶT KHO:
- Mã đơn giữ chỗ: ${bookingCode}
- Trạng thái hiện tại: CHỜ CHECK IN
- Cơ sở tiếp đón: ${facilityName}
- Địa chỉ: ${updatedRes.facility?.address || 'Tại cơ sở đã đăng ký'}
- Lịch hẹn nhận buồng kho: ${checkInDate} (${checkInTime})
- Quy cách kho: ${updatedRes.unitCode || updatedRes.size?.volumeText || 'Kho tự quản thông minh Boxora'}
- Số CCCD đối chiếu khi đến: ${idCard}

LƯU Ý QUAN TRỌNG KHI ĐẾN NHẬN KHO:
1. Khi đến cơ sở theo lịch hẹn, Quý khách vui lòng mang theo CCCD bản gốc (số ${idCard}) để đối chiếu hồ sơ.
2. Nhân viên tiếp đón (Staff) sẽ trực tiếp dẫn Quý khách nghiệm thu buồng kho thực tế, hỗ trợ thủ tục ký hợp đồng và xác nhận thanh toán tiền cọc & tiền thuê tại quầy.
3. Sau khi hoàn tất thủ tục bàn giao, hệ thống sẽ tự động kích hoạt mã PIN và nút vào Portal điều khiển khóa thông minh IoT 24/7 trên tài khoản của Quý khách.

Hotline hỗ trợ 24/7: ${updatedRes.facility?.contactPhone || '1900-BOXORA'}

Trân trọng,
Đội ngũ Quản lý Vận hành Boxora Smart Storage.`

      const dispatchedEmail: DispatchedEmail = {
        id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        to: recipientEmail,
        recipientName: customerName,
        bookingCode,
        type: 'CONFIRMED',
        subject: emailSubject,
        body: emailBody,
        sentAt: nowIso,
        facilityName,
        status: 'SENT',
      }

      // Lưu vào danh sách email đã gửi
      try {
        const sentEmails = JSON.parse(localStorage.getItem('boxora_sent_emails') || '[]')
        sentEmails.unshift(dispatchedEmail)
        localStorage.setItem('boxora_sent_emails', JSON.stringify(sentEmails))
      } catch (e) {}

      // Tạo thông báo In-App cho khách hàng
      try {
        const notif = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          channel: 'CUSTOMER_PORTAL',
          notificationType: 'BOOKING_CONFIRMED',
          referenceType: 'BOOKING',
          referenceId: bookingCode,
          title: `Đơn giữ chỗ ${bookingCode} đã được xác nhận (Chờ check in)`,
          content: `Nhân viên Boxora tại ${facilityName} đã xác nhận đơn của bạn lúc ${nowTimeStr}. Trạng thái đã chuyển sang "Chờ check in". Email hướng dẫn chi tiết đã được gửi tới ${recipientEmail}.`,
          status: 'UNREAD',
          createdAt: nowIso,
        }
        const existing = JSON.parse(localStorage.getItem('boxora_in_app_notifications') || '[]')
        existing.unshift(notif)
        localStorage.setItem('boxora_in_app_notifications', JSON.stringify(existing))
        window.dispatchEvent(new CustomEvent('boxora_notification_pushed', { detail: notif }))
      } catch (e) {}

      // Phát sự kiện toàn hệ thống
      window.dispatchEvent(new CustomEvent('boxora_reservation_status_changed', {
        detail: { bookingCode, status: 'CONFIRMED', updatedReservation: updatedRes, email: dispatchedEmail }
      }))
      window.dispatchEvent(new CustomEvent('boxora_email_dispatched', { detail: dispatchedEmail }))

      return {
        success: true,
        email: dispatchedEmail,
        message: `Đã xác nhận đơn ${bookingCode} thành công! Đơn đã chuyển sang trạng thái "Chờ check in" và hệ thống đã gửi email xác nhận tới ${recipientEmail}.`,
        updatedReservation: updatedRes,
      }
    } catch (err: any) {
      console.error('Error confirming reservation:', err)
      return { success: false, message: 'Có lỗi xảy ra khi xác nhận đơn.' }
    }
  },

  // 2. Thao tác Từ chối đơn của nhân viên: Có điền lý do, chuyển trạng thái sang CANCELLED và gửi email
  rejectReservation(
    bookingCode: string,
    reason: string,
    staffUser?: { id?: string; fullName?: string }
  ): { success: boolean; email?: DispatchedEmail; message: string; updatedReservation?: any } {
    if (!reason || !reason.trim()) {
      return { success: false, message: 'Vui lòng nhập lý do từ chối đơn đặt giữ chỗ.' }
    }

    try {
      const raw = localStorage.getItem('boxora_guest_reservations')
      let list: any[] = raw ? JSON.parse(raw) : []
      const index = list.findIndex(r => r.bookingCode === bookingCode || r.id === bookingCode)

      let resObj = index !== -1 ? list[index] : null
      const nowIso = new Date().toISOString()
      const nowTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN')

      const updatedRes = {
        ...(resObj || {}),
        bookingCode,
        status: 'CANCELLED', // Hủy / Từ chối
        rejectedByStaffId: staffUser?.id || 'staff',
        rejectedByStaffName: staffUser?.fullName || 'Nhân viên trực ca Boxora',
        rejectedAt: nowIso,
        rejectionReason: reason.trim(),
      }

      if (index !== -1) {
        list[index] = updatedRes
      } else {
        list.unshift(updatedRes)
      }
      localStorage.setItem('boxora_guest_reservations', JSON.stringify(list))

      // Tạo email gửi cho khách hàng
      const recipientEmail = updatedRes.customerEmail || updatedRes.customer?.email || 'customer@boxora.vn'
      const customerName = updatedRes.customerName || updatedRes.customer?.fullName || 'Quý khách'
      const facilityName = updatedRes.facilityName || updatedRes.facility?.name || 'Cơ sở Boxora'

      const emailSubject = `[BOXORA] Thông báo về đơn đặt giữ chỗ ${bookingCode}`
      const emailBody = `Kính gửi Quý khách ${customerName},

Boxora trân trọng cảm ơn Quý khách đã quan tâm đến dịch vụ kho tự quản thông minh.

Liên quan đến đơn đặt giữ chỗ mã số ${bookingCode} tại ${facilityName}:
Rất tiếc, hiện tại đơn giữ chỗ của Quý khách chưa thể tiếp nhận với lý do sau:
"${reason.trim()}"

Nếu Quý khách cần thêm thông tin, muốn đổi lịch hẹn hoặc chọn chi nhánh khác, xin vui lòng:
- Gọi trực tiếp đến Hotline hỗ trợ: ${updatedRes.facility?.contactPhone || '1900-BOXORA'}
- Hoặc truy cập website Boxora để thực hiện đặt buồng kho mới.

Chúng tôi rất xin lỗi vì sự bất tiện này và hy vọng được phục vụ Quý khách trong thời gian sớm nhất.

Trân trọng,
Đội ngũ Quản lý Vận hành Boxora Smart Storage.`

      const dispatchedEmail: DispatchedEmail = {
        id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        to: recipientEmail,
        recipientName: customerName,
        bookingCode,
        type: 'REJECTED',
        subject: emailSubject,
        body: emailBody,
        sentAt: nowIso,
        facilityName,
        status: 'SENT',
        rejectionReason: reason.trim(),
      }

      // Lưu vào danh sách email đã gửi
      try {
        const sentEmails = JSON.parse(localStorage.getItem('boxora_sent_emails') || '[]')
        sentEmails.unshift(dispatchedEmail)
        localStorage.setItem('boxora_sent_emails', JSON.stringify(sentEmails))
      } catch (e) {}

      // Tạo thông báo In-App cho khách hàng
      try {
        const notif = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          channel: 'CUSTOMER_PORTAL',
          notificationType: 'BOOKING_REJECTED',
          referenceType: 'BOOKING',
          referenceId: bookingCode,
          title: `Đơn giữ chỗ ${bookingCode} không được tiếp nhận`,
          content: `Đơn đặt giữ chỗ của bạn tại ${facilityName} đã bị từ chối vào lúc ${nowTimeStr}. Lý do: "${reason.trim()}". Chi tiết đã được gửi tới email ${recipientEmail}.`,
          status: 'UNREAD',
          createdAt: nowIso,
        }
        const existing = JSON.parse(localStorage.getItem('boxora_in_app_notifications') || '[]')
        existing.unshift(notif)
        localStorage.setItem('boxora_in_app_notifications', JSON.stringify(existing))
        window.dispatchEvent(new CustomEvent('boxora_notification_pushed', { detail: notif }))
      } catch (e) {}

      // Phát sự kiện toàn hệ thống
      window.dispatchEvent(new CustomEvent('boxora_reservation_status_changed', {
        detail: { bookingCode, status: 'CANCELLED', reason: reason.trim(), updatedReservation: updatedRes, email: dispatchedEmail }
      }))
      window.dispatchEvent(new CustomEvent('boxora_email_dispatched', { detail: dispatchedEmail }))

      return {
        success: true,
        email: dispatchedEmail,
        message: `Đã từ chối đơn ${bookingCode} với lý do: "${reason.trim()}". Đã gửi email thông báo tới ${recipientEmail}.`,
        updatedReservation: updatedRes,
      }
    } catch (err: any) {
      console.error('Error rejecting reservation:', err)
      return { success: false, message: 'Có lỗi xảy ra khi từ chối đơn.' }
    }
  },
}

