export interface DispatchedEmail {
  id: string
  to: string
  recipientName: string
  bookingCode: string
  type: 'CONFIRMED' | 'REJECTED' | 'OVERDUE_REMINDER'
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

      // Giải phóng buồng kho vật lý nếu đã gán để khôi phục số lượng kho khả dụng ở Bước 2
      if (updatedRes.storageUnitId || updatedRes.unitCode) {
        try {
          const rawUnits = localStorage.getItem('boxora_storage_units')
          if (rawUnits) {
            let uList = JSON.parse(rawUnits)
            if (Array.isArray(uList)) {
              let unitChanged = false
              uList = uList.map((u: any) => {
                if ((updatedRes.storageUnitId && u.id === updatedRes.storageUnitId) ||
                    (updatedRes.unitCode && u.unitCode === updatedRes.unitCode)) {
                  unitChanged = true
                  return { ...u, status: 'AVAILABLE', tenantName: undefined, contractCode: undefined }
                }
                return u
              })
              if (unitChanged) {
                localStorage.setItem('boxora_storage_units', JSON.stringify(uList))
              }
            }
          }
        } catch {}
      }

      // Phát sự kiện toàn hệ thống
      window.dispatchEvent(new CustomEvent('boxora:storage-units-refresh'))
      window.dispatchEvent(new CustomEvent('boxora_reservation_updated', {
        detail: { bookingCode, status: 'CANCELLED' }
      }))
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

  // 3. Quét và gửi email nhắc nhở quá hạn 24h check-in cho đơn ký & thanh toán tại quầy
  sendCheckinOverdueReminder(bookingCode: string): { success: boolean; email?: DispatchedEmail; message: string } {
    try {
      const raw = localStorage.getItem('boxora_guest_reservations')
      let list: any[] = raw ? JSON.parse(raw) : []
      const index = list.findIndex(r => r.bookingCode === bookingCode || r.id === bookingCode)
      if (index === -1) return { success: false, message: 'Không tìm thấy đơn đặt kho' }

      const r = list[index]
      if (r.checkinOverdueReminderSentAt) {
        return { success: false, message: 'Đã gửi email nhắc nhở trước đó' }
      }

      const nowIso = new Date().toISOString()
      const recipientEmail = r.customerEmail || r.customer?.email || 'customer@boxora.vn'
      const customerName = r.customerName || r.customer?.fullName || 'Quý khách'
      const facilityName = r.facilityName || r.facility?.name || 'Cơ sở Boxora'
      const facilityAddress = r.facilityAddress || r.facility?.address || 'Tại cơ sở Boxora đã đăng ký'
      const facilityPhone = r.facilityPhone || r.facility?.contactPhone || '1900-BOXORA'
      const unitCode = r.unitCode || r.size?.volumeText || 'Kho tự quản Boxora'
      const checkInDate = r.checkInDate || 'ngày hẹn'
      const checkInTime = r.checkInTime || '09:00'

      const emailSubject = `[BOXORA - KHẨN CẤP] Nhắc nhở: Quá hạn 24 giờ tiếp nhận buồng kho ${unitCode} - Đơn ${bookingCode}`
      const emailBody = `Kính gửi Quý khách ${customerName},

Đơn đặt giữ chỗ buồng kho mã số ${bookingCode} tại cơ sở ${facilityName} theo hình thức Ký giấy & thanh toán tại quầy đã QUÁ 24 GIỜ kể từ thời gian hẹn check-in (${checkInTime} - ${checkInDate}) nhưng hiện tại vẫn chưa hoàn tất thủ tục tiếp nhận.

THÔNG TIN ĐƠN ĐẶT KHO:
- Mã đơn đặt kho: ${bookingCode}
- Cơ sở tiếp đón: ${facilityName}
- Địa chỉ: ${facilityAddress}
- Buồng kho đăng ký: ${unitCode}
- Lịch hẹn check-in: ${checkInTime} - ${checkInDate}
- Trạng thái: CHƯA TIẾP NHẬN - QUÁ HẠN 24 GIỜ

YÊU CẦU ĐẾN CƠ SỞ HOÀN TẤT THỦ TỤC & CẢNH BÁO HỦY ĐƠN:
1. Quý khách vui lòng nhanh chóng mang theo CCCD / Hộ chiếu bản gốc đến cơ sở ${facilityName} để nhân viên quầy hướng dẫn làm thủ tục ký hợp đồng và nhận kho.
2. LƯU Ý ĐẶC BIỆT: Sau thêm 24 giờ tiếp theo (tổng cộng 48 giờ kể từ lịch hẹn check-in), nếu Quý khách vẫn chưa đến cơ sở tiếp nhận, hệ thống sẽ mở quyền HỦY ĐƠN cho nhân viên và quản lý cơ sở, buồng kho sẽ được giải phóng lại trên hệ thống để phục vụ khách hàng khác.

Hotline hỗ trợ 24/7: ${facilityPhone}

Trân trọng,
Đội ngũ Quản lý Vận hành Boxora Smart Storage.`

      const dispatchedEmail: DispatchedEmail = {
        id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        to: recipientEmail,
        recipientName: customerName,
        bookingCode,
        type: 'OVERDUE_REMINDER',
        subject: emailSubject,
        body: emailBody,
        sentAt: nowIso,
        facilityName,
        status: 'SENT',
      }

      r.checkinOverdueReminderSentAt = nowIso
      list[index] = r
      localStorage.setItem('boxora_guest_reservations', JSON.stringify(list))

      try {
        const sentEmails = JSON.parse(localStorage.getItem('boxora_sent_emails') || '[]')
        sentEmails.unshift(dispatchedEmail)
        localStorage.setItem('boxora_sent_emails', JSON.stringify(sentEmails))
      } catch {}

      try {
        const notif = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          channel: 'CUSTOMER_PORTAL',
          notificationType: 'CHECKIN_OVERDUE_WARNING',
          referenceType: 'BOOKING',
          referenceId: bookingCode,
          title: `[Cảnh báo] Đơn giữ chỗ ${bookingCode} quá 24h chưa tiếp nhận`,
          content: `Đơn của bạn tại ${facilityName} đã quá 24h kể từ lịch hẹn check-in. Vui lòng đến cơ sở mang CCCD nhận kho. Sau thêm 24h nữa đơn sẽ bị hủy và hoàn kho.`,
          status: 'UNREAD',
          createdAt: nowIso,
        }
        const existing = JSON.parse(localStorage.getItem('boxora_in_app_notifications') || '[]')
        existing.unshift(notif)
        localStorage.setItem('boxora_in_app_notifications', JSON.stringify(existing))
        window.dispatchEvent(new CustomEvent('boxora_notification_pushed', { detail: notif }))
      } catch {}

      window.dispatchEvent(new CustomEvent('boxora_email_dispatched', { detail: dispatchedEmail }))
      window.dispatchEvent(new Event('boxora:notifications-refresh'))

      return {
        success: true,
        email: dispatchedEmail,
        message: `Đã gửi email cảnh báo quá hạn 24h tới ${recipientEmail}.`,
      }
    } catch (err: any) {
      console.error('Error sending checkin overdue reminder:', err)
      return { success: false, message: 'Lỗi gửi email nhắc nhở' }
    }
  },

  // 4. Quét toàn bộ danh sách đơn đặt để tự động gửi email quá hạn 24h
  checkAndSendOverdueReminders(): number {
    try {
      const raw = localStorage.getItem('boxora_guest_reservations')
      if (!raw) return 0
      const list = JSON.parse(raw)
      if (!Array.isArray(list)) return 0

      let count = 0
      const now = Date.now()

      for (const r of list) {
        const isInPerson = r.signingMethod === 'IN_PERSON' || r.paymentMethod === 'AT_FACILITY' || r.paymentMethod === 'IN_PERSON'
        const isNotFinished = r.status !== 'ACTIVE' && r.status !== 'COMPLETED' && r.status !== 'CANCELLED' && !r.handoverTime
        if (!isInPerson || !isNotFinished || r.checkinOverdueReminderSentAt) continue

        let checkInTime = 0
        if (r.expectedCheckInAt) {
          checkInTime = new Date(r.expectedCheckInAt).getTime()
        } else if (r.checkInDate) {
          const t = r.checkInTime ? r.checkInTime.split(' - ')[0] || '09:00' : '09:00'
          checkInTime = new Date(`${r.checkInDate}T${t}:00`).getTime()
        } else if (r.startDate) {
          checkInTime = new Date(`${r.startDate}T09:00:00`).getTime()
        }

        if (checkInTime > 0 && (now - checkInTime) >= 24 * 60 * 60 * 1000) {
          this.sendCheckinOverdueReminder(r.bookingCode)
          count++
        }
      }
      return count
    } catch (e) {
      console.warn('checkAndSendOverdueReminders error:', e)
      return 0
    }
  },

  // Alias tuong thich neu bundle hoac trinh duyet bi dich chu Quá hạn
  'checkAndSendQuá hạnReminders'(): number {
    return this.checkAndSendOverdueReminders();
  },
  checkAndSendQuaHanReminders(): number {
    return this.checkAndSendOverdueReminders();
  },

  // 5. Thao tác Hủy đơn quá hạn 48h của nhân viên hoặc quản lý: Giải phóng kho và gửi email thông báo hủy
  cancelOverdueReservation(
    bookingCode: string,
    reason?: string,
    staffUser?: { id?: string; fullName?: string }
  ): { success: boolean; message: string; updatedReservation?: any } {
    const cancelReason = reason && reason.trim()
      ? reason.trim()
      : 'Hệ thống/Nhân viên hủy đơn do quá hạn 48 giờ sau lịch hẹn check-in khách hàng chưa đến tiếp nhận kho'
    return this.rejectReservation(bookingCode, cancelReason, staffUser)
  },
}

