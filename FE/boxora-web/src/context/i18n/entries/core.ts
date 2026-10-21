/**
 * Hand-maintained English entries that win over the generated ones: relative time, verb patterns, and words whose
 * translation depends on where they appear (`@action` = only inside a button or link).
 */
export const CORE_ENTRIES: Record<string, string> = {
  // formatRelativeTime
  'Vừa xong': 'Just now',
  '{} phút trước': '{1} min ago',
  '{} giờ trước': '{1} h ago',
  '{} ngày trước': '{1} {1:day|days} ago',
  '{} phút nữa': 'in {1} min',
  '{} giờ nữa': 'in {1} h',
  '{} ngày nữa': 'in {1} {1:day|days}',

  // Permission descriptions are "<verb> <resource>"; the resource must be a known phrase.
  'Xem {t}': 'View {1}',
  'Tạo {t}': 'Create {1}',
  'Cập nhật {t}': 'Update {1}',
  'Xóa {t}': 'Delete {1}',

  // Permission descriptions seeded in Vietnamese in the database (the others are seeded in English).
  'Tạo mới loại phí': 'Create fee types',
  'Xóa hoặc vô hiệu hóa loại phí': 'Delete or deactivate fee types',
  'Xem danh mục các loại phí phụ trợ': 'View the catalog of ancillary fee types',
  'Điều chỉnh giá thuê kho và ghi nhận lịch sử (BR-RULE-011)': 'Adjust unit rent and record the history (BR-RULE-011)',
  'Xem lịch sử thay đổi giá kho (BR-RULE-011)': 'View the unit price change history (BR-RULE-011)',
  'Lập biên bản niêm phong kho quá hạn (BR-RULE-012)': 'Create a sealing record for an overdue unit (BR-RULE-012)',
  'Mở niêm phong kho sau thanh toán (BR-RULE-012)': 'Unseal a unit after payment (BR-RULE-012)',
  'Xem biên bản niêm phong kho (BR-RULE-012)': 'View unit sealing records (BR-RULE-012)',

  // Rent breakdown lines composed by the backend (ContractBillingServiceImpl).
  'Tiền thuê các kỳ đã đến hạn ({}/{} tháng)': 'Rent for periods already due ({1}/{2} months)',
  'Tiền thuê thời gian quá hạn ({} ngày, tính theo {} khối 30 ngày)': 'Rent for the overdue period ({1} days, counted as {2} 30-day blocks)',
  'Phí trễ hạn theo chính sách cơ sở ({} ngày quá hạn)': 'Late fee under the facility policy ({1} days overdue)',
  'Hợp đồng chưa bắt đầu tính tiền thuê. Khoản thanh toán đầu tiên được thực hiện khi đặt kho hoặc khi nhận kho.': 'Rent has not started for this contract. The first payment is made when you book or pick up the unit.',
  'Bạn đã thanh toán đủ tiền thuê của hợp đồng.': 'You have paid all the rent on this contract.',
  'Kho đang làm thủ tục trả kho. Các khoản còn lại được quyết toán tại quầy.': 'The unit is being returned. Remaining amounts are settled at the counter.',
  'Hợp đồng đã hết hạn ngày {}. Thanh toán công nợ quá hạn sẽ kéo dài thời hạn thuê đến {} và mở lại quyền truy cập kho; bạn cũng có thể gia hạn hợp đồng theo tháng.': 'The contract expired on {1}. Paying the overdue balance extends the rental term to {2} and restores access to the unit; you can also renew the contract month by month.',
  'Tiền thuê được tính vào đầu mỗi kỳ hàng tháng kể từ ngày nhận kho.': 'Rent is charged at the start of each monthly period from the pickup date.',
  'Kỳ thuê tiếp theo đến hạn ngày {}.': 'The next rental period is due on {1}.',
  'Không có khoản tiền thuê nào đến hạn.': 'No rent is due.',
  'Hợp đồng chưa có hiệu lực. Bạn có thể gia hạn sau khi nhận kho.': 'The contract is not in effect yet. You can renew after you pick up the unit.',
  'Hợp đồng đã kết thúc nên không thể gia hạn.': 'The contract has ended, so it can not be renewed.',
  'Bạn đã gửi yêu cầu trả kho nên không thể gia hạn hợp đồng này.': 'You have submitted a return request, so this contract can not be renewed.',
  'Hợp đồng chưa có ngày kết thúc.': 'The contract has no end date yet.',
  'Bạn có thể gia hạn từ ngày {} (trong vòng {} ngày trước khi hợp đồng hết hạn ngày {}).': 'You can renew from {1} (within {2} days before the contract expires on {3}).',
  '{} – {} ({} tháng)': '{1} – {2} ({3} {3:month|months})',

  // Copy added after the first extraction pass.
  'VNPay hoặc tại quầy': 'VNPay or at the counter',
  'Đang hoàn tiền': 'Refunding',
  'Còn phải thanh toán (dự kiến)': 'Remaining to pay (estimated)',
  'Tiền cọc và tiền thuê tháng đầu ({}), trừ {} bạn đã thanh toán.': 'The deposit and the first month\'s rent ({1}), minus {2} you have already paid.',

  'Tên chi nhánh tối đa 150 ký tự.': 'The branch name can be at most 150 characters.',
  'Tên chi nhánh không được chứa ký tự < hoặc >.': "The branch name can't contain the characters < or >.",
  'Mã chi nhánh tối đa 30 ký tự.': 'The branch code can be at most 30 characters.',
  'Mã chi nhánh chỉ gồm chữ cái, chữ số, dấu gạch ngang, gạch dưới hoặc dấu chấm, không có khoảng trắng.':
    'The branch code can only contain letters, digits, hyphens, underscores or dots, with no spaces.',
  'Cấp / thu hồi quyền sửa chính sách ngoại lệ': 'Grant / revoke permission to edit exception policies',

  // Third-party widgets
  'Thư viện bản đồ tương tác': 'Interactive maps library',

  // The same Vietnamese word is a noun or status in a badge and a verb on a button.
  'Từ chối@action': 'Reject',
  'Đặt kho@action': 'Book a unit',
  'Gia hạn@action': 'Renew',
  'Thanh toán@action': 'Pay',
}
