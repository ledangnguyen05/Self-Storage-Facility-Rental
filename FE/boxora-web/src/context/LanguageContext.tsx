import React, { createContext, useContext, useEffect, useState, useTransition } from 'react'
import { getWebSettings, saveWebSettings } from '../utils/webSettings'

export type Language = 'vi' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, fallback?: string) => string
}

// ============================================================================
// EXHAUSTIVE BOXORA EN <-> VI TRANSLATION DICTIONARY
// ============================================================================
export const DICTIONARY: Record<string, string> = {
  // Brand & Slogans
  'KHO TỰ QUẢN THÔNG MINH ĐẦY ĐỦ TIỆN NGHI': 'FULLY EQUIPPED SMART SELF-STORAGE',
  'KHO TỰ QUẢN THÔNG MINH': 'SMART SELF-STORAGE',
  'Kho Tự Quản Thông Minh': 'Smart Self-Storage',
  'Kho tự quản thông minh': 'Smart self-storage',
  'Thuê kho thông minh tự động 24/7': 'Automated 24/7 Smart Storage Rentals',
  'Hệ thống kho tự quản thông minh hàng đầu Việt Nam': 'Leading Smart Self-Storage Network in Vietnam',
  'Hệ thống phòng kho tự quản thông minh đầu tiên tại Việt Nam ứng dụng khóa bảo mật IoT, kiểm soát vi khí hậu 24/7 và cấp mã PIN truy cập số hóa tức thời.':
    'Vietnam\'s premier smart self-storage network featuring IoT security locks, 24/7 climate monitoring, and instant digital PIN issuance.',
  '© 2026 Boxora Smart Storage. Tất cả các quyền được bảo lưu.':
    '© 2026 Boxora Smart Storage. All rights reserved.',
  'Tất cả các quyền được bảo lưu': 'All rights reserved',

  // Navigation & General
  'Trang chủ': 'Home',
  'Trang Chủ': 'Home',
  'TRANG CHỦ': 'HOME',
  'Hệ thống cơ sở': 'Facilities',
  'Hệ Thống Cơ Sở': 'Facilities',
  'HỆ THỐNG CƠ SỞ': 'FACILITIES',
  'Chi nhánh': 'Branches',
  'Nhật ký giao dịch': 'Transaction Journal',
  'Giám sát sự cố': 'Ticket Oversight',
  'Quy trình 3 bước': '3-Step Guide',
  'Quy Trình 3 Bước': '3-Step Guide',
  'QUY TRÌNH 3 BƯỚC': '3-STEP GUIDE',
  'Khóa IoT & An ninh': 'IoT & Security',
  'Khóa IoT & An Ninh': 'IoT & Security',
  'Khóa IoT & Ra Vào 24/7': 'IoT Locks & 24/7 Access',
  'Dịch vụ': 'Services',
  'DỊCH VỤ': 'SERVICES',
  'Cách hoạt động': 'How It Works',
  'CÔNG NGHỆ': 'TECHNOLOGY',
  'Công nghệ': 'Technology',
  'Hỗ trợ': 'Support',
  'HỖ TRỢ': 'SUPPORT',
  'TRỰC CA': 'Shift Roster',
  'Trực Ca': 'Shift Roster',
  'Đăng nhập': 'Sign In',
  'Đăng Nhập': 'Sign In',
  'ĐĂNG NHẬP': 'SIGN IN',
  'Đăng ký': 'Register',
  'Đăng Ký': 'Register',
  'ĐĂNG KÝ': 'REGISTER',
  'Đăng Ký Thuê': 'Register & Rent',
  'Đăng Ký Thuê Kho': 'Register Unit Rental',
  'Đăng xuất': 'Log Out',
  'Đăng Xuất': 'Log Out',
  'ĐĂNG XUẤT': 'LOG OUT',
  'Đăng xuất khỏi phiên làm việc': 'Log out of current session',
  'Thuê kho ngay': 'Rent Storage Now',
  'Thuê Kho Ngay': 'Rent Storage Now',
  'THUÊ KHO NGAY': 'RENT STORAGE NOW',
  'Đặt kho ngay': 'Rent Storage Now',
  'Khám phá dịch vụ': 'Explore Services',
  'Cuộn để khám phá': 'Scroll to Explore',
  'Cuộn xuống xem nội dung Boxora': 'Scroll to explore Boxora',
  'Cuộn lên đầu trang': 'Scroll to top',
  'Trang Giới Thiệu (Landing)': 'Landing Page',
  'Vào Portal': 'Go to Portal',
  'Vào Portal Quản Lý': 'Go to Management Portal',
  'Vào Trang Điều Hành Portal': 'Access Operations Portal',
  'Vào Portal Quản Lý Kho': 'Access Storage Portal',
  'Vào bảng điều khiển': 'Go to Dashboard',
  'Khám Phá Thuê Kho': 'Explore Units',
  'Khám Phá & Thuê Kho': 'Explore & Rent Storage',
  'Khám Phá & Đăng Ký Thuê Kho': 'Explore & Register Units',
  'Khám phá phòng kho': 'Explore Storage Units',
  'Chưa Có Kho': 'No Active Unit',
  'Chưa Kích Hoạt Kho': 'Unit Not Activated',
  'Tài Khoản Chưa Kích Hoạt Kho': 'Account Has No Active Unit',
  'Khách Mới • Thuê Kho': 'New Guest • Rent',
  'KHÁCH HÀNG MỚI (CHƯA CÓ KHO)': 'NEW CUSTOMER (NO ACTIVE UNIT)',
  'Quý khách hiện chưa có hợp đồng kho đang hoạt động. Vui lòng truy cập Dashboard tìm kiếm & thuê kho để định vị khoảng cách, chọn phòng kho và nhận mã PIN mở app.':
    'You do not have an active rental contract yet. Please visit the Units Explorer to calculate distances, pick a unit, and receive your digital PIN.',
  'Đi Đến Dashboard Tìm & Thuê Kho': 'Go to Units Explorer',
  'Dashboard Tìm Kho': 'Units Explorer',
  'Dashboard Tìm & Thuê Kho': 'Units Explorer & Rentals',
  'Tìm & Thuê Kho': 'Find & Rent Units',
  'Tìm & thuê kho': 'Find & rent units',
  'Tìm phòng kho': 'Find a storage unit',
  'Tìm Kiếm & Đặt Thuê Kho': 'Search & Rent Storage Units',

  // Hero Section
  'Không gian lưu trữ linh hoạt': 'Flexible Smart Storage Space',
  'Chọn diện tích phù hợp • Vào kho 24/7 bằng mã PIN': 'Choose optimal size • 24/7 access via digital PIN',
  'Chọn diện tích phù hợp': 'Choose optimal size',
  'Vào kho 24/7 bằng mã PIN': '24/7 access via digital PIN',

  // 3-Step Process
  'Bắt Đầu Thuê Kho Chỉ Trong 3 Bước': 'Start Renting Storage In 3 Simple Steps',
  'Không thủ tục giấy tờ rườm rà. Toàn bộ quy trình hoàn tất trực tuyến minh bạch, chuẩn xác và bảo mật.':
    'No paperwork hassle. The entire process is completed online with transparency, precision, and security.',
  'BƯỚC 1': 'STEP 1',
  'BƯỚC 2': 'STEP 2',
  'BƯỚC 3': 'STEP 3',
  'Bước 1: Chọn kho & Đăng ký online': 'Step 1: Choose unit & register online',
  'Bước 2: Thanh toán & Nhận mã PIN': 'Step 2: Pay & receive digital PIN',
  'Bước 3: Mở cửa kho 24/7 bằng app': 'Step 3: Access 24/7 via mobile app',
  'Quy trình thuê kho tự quản nhanh chóng chỉ với 3 bước': 'Quick 3-step self-storage rental process',
  'Tìm Kho & Đo Khoảng Cách': 'Locate Unit & Measure Distance',
  'Định vị vị trí của bạn trên Dashboard, đo cự ly di chuyển tới từng cơ sở Boxora và lựa chọn kích thước buồng kho phù hợp nhất với nhu cầu cất giữ.':
    'Pinpoint your current location on the Dashboard, measure travel distance to each Boxora facility, and select the optimal unit size for your storage needs.',
  'Định vị cự ly GPS thời gian thực': 'Real-time GPS proximity tracking',
  'Ký Hợp Đồng & Đặt Cọc Số Hóa': 'Digital Contract & Secure Deposit',
  'Ký kết thỏa thuận hợp đồng điện tử bảo chứng pháp lý, thanh toán an toàn qua cổng ngân hàng bảo mật và nhận hóa đơn VAT điện tử tự động.':
    'Sign legally binding digital contracts, pay safely via encrypted banking gateway, and receive automatic e-VAT invoices.',
  'Hợp đồng điện tử bảo chứng pháp lý': 'Legally binding digital contracts',
  'Nhận Mã PIN & Vào Kho 24/7': 'Get PIN Code & 24/7 Access',
  'Hệ thống tự động cấp mã PIN số hóa riêng biệt tức thì. Bạn có thể tự do mở cửa kho và quản lý tài sản bất kỳ lúc nào ngày hay đêm qua app.':
    'System automatically issues an instant personalized digital PIN. Freely unlock your storage unit and manage belongings 24/7 via mobile app.',
  'Cấp PIN tức thì • Vào kho tự do 24/7': 'Instant PIN generation • 24/7 free access',

  // IoT Access & Smart Security
  'Công Nghệ Khóa Điện Tử IoT & Bảo Mật Đa Tầng': 'IoT Electronic Lock Tech & Multi-Layer Security',
  'Mỗi buồng kho Boxora đều được tích hợp khóa điện tử kết nối mạng độc lập và hệ thống cảm biến môi trường, đảm bảo tài sản của bạn luôn an toàn tuyệt đối mà không cần sử dụng chìa khóa cơ truyền thống.':
    'Each Boxora storage unit features an independent networked electronic lock and climate sensors, keeping your belongings strictly secured without traditional physical keys.',
  'KHÔNG CẦN CHÌA KHÓA': 'KEYLESS ACCESS',
  'Mã PIN & Mở Qua App': 'PIN Code & App Access',
  'Cấp mã PIN số hóa bảo mật ngay sau khi thuê. Ra vào kho 24/7 chỉ với mã số trên bàn phím cảm ứng hoặc một chạm trên điện thoại mà không lo thất lạc chìa khóa.':
    'Receive encrypted digital PIN immediately after booking. Access 24/7 via touchpad passcode or one-tap mobile app without key loss worries.',
  'CHỐNG QUÊN CỬA': 'AUTO-LOCK PROTECTION',
  'Tự Động Chốt Khóa Sau Đóng': 'Auto-Lock Upon Door Closure',
  'Cảm biến từ tính phát hiện trạng thái cánh cửa và tự động kích hoạt chốt khóa sau 3 giây. Hệ thống sẽ phát cảnh báo âm thanh và gửi thông báo nếu bạn vô tình để hở cửa quá lâu.':
    'Magnetic sensors detect door position and engage the lock bolt after 3 seconds. Audible alerts and push notifications trigger if door is left open.',
  'CHIA SẺ TIỆN LỢI': 'EASY SHARING',
  'Cấp Mã Phụ Dùng Một Lần': 'Issue One-Time Guest PIN',
  'Dễ dàng tạo mã PIN tạm thời hoặc mã 1 lần gửi cho người thân, shipper hoặc nhân viên khi cần nhờ nhận hoặc lấy đồ, và chủ động thu hồi quyền bất kỳ lúc nào.':
    'Easily generate temporary or one-time access codes for family, couriers, or staff to drop off or retrieve items, and revoke access at any time.',
  'VI KHÍ HẬU & NHẬT KÝ': 'MICROCLIMATE & AUDIT LOG',
  'Cảm Biến Môi Trường': 'Environmental Climate Sensors',
  'Duy trì nhiệt độ 20-22°C và độ ẩm dưới 50% RH chống ẩm mốc đồ đạc. Toàn bộ mốc thời gian mở và khóa cửa đều được ghi nhận minh bạch trên nhật ký ứng dụng.':
    'Maintains 20-22°C and humidity below 50% RH against moisture and mildew. All unlock and access timestamps are logged transparently in-app.',

  // Services
  'Giải Pháp Lưu Trữ Toàn Diện Cho Cá Nhân & Doanh Nghiệp': 'Comprehensive Storage Solutions for Personal & Business',
  'GIẢI PHÁP LƯU TRỮ THÔNG MINH': 'SMART STORAGE SOLUTIONS',
  'Mỗi buồng kho tại Boxora được thiết kế chuyên biệt theo tiêu chuẩn quốc tế, đáp ứng linh hoạt từ nhu cầu cất giữ tư trang cá nhân đến kho logistics trung chuyển hàng hóa.':
    'Every Boxora unit is purpose-engineered to international standards, catering flexibly from personal belongings to enterprise logistics.',
  'TIỆN ÍCH CÁ NHÂN': 'PERSONAL UTILITY',
  'Kho Cá Nhân 24/7': '24/7 Personal Storage',
  'Lưu giữ an toàn đồ dùng theo mùa, vali du lịch, nội thất khi sửa nhà, bộ sưu tập cá nhân. Ra vào tự do mọi lúc không cần đặt lịch hẹn trước.':
    'Secure storage for seasonal items, travel luggage, furniture during home renovations, and collectibles. 24/7 free access without prior booking.',
  'Diện tích linh hoạt từ 1.5m²': 'Flexible sizes starting from 1.5m²',
  'Mã PIN số hóa cá nhân độc quyền': 'Exclusive digital access PIN',
  'Miễn phí xe đẩy hàng tại chỗ': 'Complimentary on-site cargo trolleys',
  'Thuê theo tháng linh hoạt': 'Flexible monthly rentals',
  'Từ 450k/tháng': 'From 450k VND/mo',
  'KIỂM SOÁT NHIỆT ẨM': 'CLIMATE CONTROL',
  'Kho Mát Vi Khí Hậu': 'Climate-Controlled Storage',
  'Kho Mát Vi Khí Hậu (16–22°C)': 'Climate-Controlled Storage (16–22°C)',
  'Duy trì ổn định 16°C – 22°C và độ ẩm 45% – 55% RH liên tục 24/7. Giải pháp tối ưu chống nấm mốc cho máy ảnh, đồ da, tài liệu, tranh ảnh và thiết bị điện tử.':
    'Maintains constant 16°C – 22°C and 45% – 55% RH 24/7. Optimal mildew-prevention solution for cameras, leather goods, documents, art, and electronics.',
  '16°C – 22°C // Độ ẩm < 50% RH': '16°C – 22°C // Humidity < 50% RH',
  'Cảm biến IoT cảnh báo lệch nhiệt': 'IoT sensors with deviation alerts',
  'Lọc khí khử ẩm đa tầng': 'Multi-stage air filtration & dehumidification',
  'Bảo quản chuẩn studio': 'Studio-grade preservation',
  'Chuẩn cao cấp': 'Premium Standard',
  'DOANH NGHIỆP & E-COMMERCE': 'ENTERPRISE & E-COMMERCE',
  'Kho Doanh Nghiệp & Hồ Sơ': 'Business & Document Storage',
  'Lưu trữ hồ sơ chứng từ kế toán 10 năm, thiết bị sự kiện, hàng tồn kho bán lẻ trực tuyến. Hỗ trợ hợp đồng pháp nhân, xuất hóa đơn VAT điện tử nhanh chóng.':
    'Store 10-year accounting records, event gear, and e-commerce inventory. Corporate entity agreements with instant digital VAT invoicing.',
  'Cửa cuốn & Bãi xe tải 2.5 tấn': 'Roller shutter & 2.5-ton truck bay',
  'Hóa đơn VAT & Ký HĐ điện tử': 'VAT invoices & e-contract signing',
  'Cấp mã PIN phụ cho shipper/nhân viên': 'Guest PIN for couriers / staff',
  'Hợp đồng pháp lý chuẩn': 'Standard legal agreements',
  'VAT đầy đủ': 'Full VAT included',
  'HẬU CẦN & TIẾP VẬN': 'LOGISTICS & PACKING',
  'Dịch Vụ Tiếp Vận & Đóng Gói': 'Logistics & Packing Services',
  'Tiếp Vận & Đóng Gói': 'Logistics & Packing Services',
  'Cung ứng thùng carton chịu lực 5 lớp, màng cuốn PE, bọc bóng khí bubble wrap. Hỗ trợ nhận hàng ký gửi thay khách từ các đơn vị vận chuyển đối tác.':
    'Supplying 5-layer heavy-duty boxes, stretch wrap, and bubble wrap. Authorized parcel acceptance from partner logistics carriers.',
  'Vật tư đóng gói tiêu chuẩn tại chỗ': 'Standard packing supplies on-site',
  'Nhận ký gửi hàng thay khách 24/7': '24/7 parcel receipt on customer\'s behalf',
  'Sảnh bốc dỡ hàng có mái che': 'Covered cargo loading bay',
  'Hỗ trợ trọn gói tận nơi': 'Full-service on-site support',
  'Tiện ích kèm theo': 'Included Amenities',

  // Size Guide & Estimator
  'Bộ Ước Tính Kích Cỡ & Sức Chứa Buồng Kho Chuẩn': 'Unit Size Estimator & Capacity Guide',
  'Bộ Ước Tính Kích Cỡ Kho': 'Unit Size Estimator',
  'Chiều cao trần tiêu chuẩn từ 2.7m – 3.0m giúp tối ưu thể tích lưu trữ theo chiều dọc. Chọn kích cỡ buồng kho bên dưới để xem trực quan những vật dụng thực tế có thể cất giữ.':
    'Standard ceiling height of 2.7m – 3.0m maximizes vertical storage volume. Select a unit size below to visualize real-world items that fit.',
  'Locker Mini & Đồ Cá Nhân': 'Mini Locker & Personal Items',
  'Buồng Kho Tiêu Chuẩn': 'Standard Storage Unit',
  'Buồng Kho Lớn Đa Năng': 'Large Versatile Storage Unit',
  'Kho Doanh Nghiệp & Sỉ': 'Enterprise & Wholesale Storage',
  'Giải pháp nhỏ gọn, tối ưu chi phí lưu giữ tư trang cá nhân, vali du lịch lớn, tài liệu công việc và đồ thể thao.':
    'Compact, cost-effective solution for personal belongings, large travel suitcases, work documents, and sports gear.',
  'Không gian đa dụng nhất: Chứa được xe máy, nội thất gia đình tháo lắp, tủ kệ mini và hàng chục thùng đồ gia dụng.':
    'Most versatile space: Accommodates motorbikes, modular furniture, mini cabinets, and dozens of household carton boxes.',
  'Dung tích rộng rãi cho đồ đạc nguyên căn hộ, nội thất cồng kềnh, thiết bị tổ chức sự kiện hoặc máy móc văn phòng.':
    'Spacious capacity for full apartment contents, bulky furniture, event equipment, or office machinery.',
  'Thiết kế cửa cuốn tự động riêng biệt, chịu tải trọng lớn, xe tải 2.5T – 5T đỗ bốc dỡ hàng trực tiếp tại sảnh có mái che.':
    'Private automatic motorized roller doors, heavy load tolerance, and direct 2.5T–5T truck loading under covered canopies.',
  '4–6 Vali lớn': '4–6 Large suitcases',
  '10 Thùng carton tiêu chuẩn': '10 Standard carton boxes',
  'Đồ thể thao, máy ảnh, laptop': 'Sports gear, cameras, laptops',
  'Giấy tờ hồ sơ đóng hộp': 'Boxed paperwork & archives',
  '1–2 Xe máy hoặc xe đạp điện': '1–2 Motorbikes or e-bikes',
  'Bàn làm việc, ghế công thái học': 'Work desk, ergonomic chairs',
  'Tủ quần áo mini, kệ sách': 'Mini wardrobe, bookshelves',
  '25–30 Thùng carton đồ đạc': '25–30 Household carton boxes',
  'Sofa chữ L, giường đệm Queen/King': 'L-shaped sofa, Queen/King beds',
  'Tủ lạnh side-by-side, máy giặt': 'Side-by-side fridge, washer',
  'Bộ bàn ăn 6 ghế, tủ kệ lớn': '6-seat dining set, large cabinets',
  '50–70 Thùng hàng hóa': '50–70 Cargo boxes',
  '6–10 Pallet hàng tiêu chuẩn': '6–10 Standard cargo pallets',
  'Hồ sơ chứng từ lưu trữ 10 năm': '10-year enterprise archive boxes',
  'Hàng tồn kho E-commerce số lượng lớn': 'High-volume e-commerce inventory',
  'Thiết bị triển lãm, hội chợ': 'Exhibition & trade-fair equipment',
  'Từ 450.000đ / tháng': 'From 450,000 VND / month',
  'Từ 950.000đ / tháng': 'From 950,000 VND / month',
  'Từ 1.850.000đ / tháng': 'From 1,850,000 VND / month',
  'Từ 3.600.000đ / tháng': 'From 3,600,000 VND / month',
  'Cửa thép đơn khóa IoT mã PIN': 'Single steel door with IoT digital PIN',
  'Cửa bản lề rộng 1.0m, mở 180°': '1.0m wide hinged door, 180° swing',
  'Cửa thép đôi rộng 1.6m tiện bốc xếp': '1.6m double steel door for easy cargo loading',
  'Cửa cuốn motor tự động 2.4m': '2.4m automatic motorized roller shutter',
  'Sinh viên, cá nhân, người đi công tác, chuyên gia': 'Students, individuals, business travelers, expats',
  'Gia đình sửa nhà, chuyển trọ, shop bán hàng online': 'Home renovations, relocation, online retail stores',
  'Cải tạo toàn bộ nhà ở, đi định cư nước ngoài, studio ảnh': 'Full home remodels, overseas relocation, photo studios',
  'Doanh nghiệp thương mại, công ty phân phối, đại lý bán sỉ': 'Commercial businesses, distributors, wholesale agents',
  'QUY CÁCH:': 'SPECS:',
  'Thể Tích:': 'Volume:',
  'Vật dụng có thể cất giữ thực tế:': 'Real-world items that fit:',
  'Loại cửa:': 'Door Type:',
  'Phù hợp cho:': 'Best for:',
  'MỨC GIÁ THAM KHẢO': 'ESTIMATED PRICING',
  'Đã bao gồm điện, bảo mật IoT 24/7 và bảo hiểm tài sản cơ bản': 'Includes electricity, 24/7 IoT security, and basic insurance',
  'Chiều cao trần:': 'Ceiling height:',
  'Khóa an ninh:': 'Security lock:',
  'Ra vào kho:': 'Access:',
  'Tự do 24/7': '24/7 Free Access',
  'Xem Các Buồng Trống Hạng Này': 'View Available Units in this Tier',

  // Policies
  'Chính Sách Thuê Kho Rõ Ràng & Minh Bạch Tuyệt Đối': 'Clear & 100% Transparent Rental Policies',
  'Boxora cam kết đặt quyền lợi và sự an tâm của khách hàng lên hàng đầu. Mọi điều khoản về tài chính, an toàn và bảo hiểm đều được quy định minh bạch và bảo hộ pháp lý.':
    'Boxora places customer peace of mind first. All financial terms, safety protocols, and insurance provisions are transparently defined and legally protected.',
  'Chính Sách Hoàn Cọc Trong 24h': '24-Hour Deposit Refund Policy',
  'Bảo Hiểm Tài Sản 50–200 Triệu': '50–200M Property Insurance',
  'Gia Hạn & Hủy Hợp Đồng': 'Contract Renewal & Termination',
  'Danh Mục Hàng Cấm & PCCC': 'Prohibited Goods & Fire Safety',
  'Hoàn Cọc & Chi Phí': 'Deposit & Fees',
  'Bảo Hiểm Tài Sản': 'Property Insurance',
  'Gia Hạn & Hủy HĐ': 'Renewal & Cancellation',
  'Hàng Cấm & PCCC': 'Prohibited Goods & Fire Safety',
  'Chính Sách Đặt Cọc & Hoàn Trả Tiền Cọc 100% Trong 24 Giờ': 'Deposit Policy & 100% Refund Within 24 Hours',
  'ÁP DỤNG CHO TOÀN BỘ KHÁCH HÀNG CÁ NHÂN VÀ DOANH NGHIỆP': 'APPLIES TO ALL INDIVIDUAL AND BUSINESS CUSTOMERS',
  '01 // TIỀN CỌC CHUẨN': '01 // STANDARD DEPOSIT',
  'Chỉ 01 Tháng Tiền Thuê': 'Only 01 Month Rental',
  'Tiền cọc giữ chỗ và bảo đảm buồng kho cố định tương đương 01 tháng tiền thuê, được niêm phong trong tài khoản ký quỹ riêng biệt.':
    'Deposit securing the unit equals 1 month rent, sealed in a dedicated escrow account.',
  '02 // HOÀN TIỀN TRONG 24H': '02 // REFUND IN 24H',
  'Chuyển Khoản Trực Tiếp': 'Direct Bank Transfer',
  'Khi thanh lý hợp đồng và nghiệm thu buồng kho còn nguyên vẹn, Boxora cam kết hoàn trả 100% tiền cọc vào tài khoản ngân hàng trong vòng 24h làm việc.':
    'Upon contract termination and intact unit inspection, Boxora refunds 100% deposit to your bank within 24 working hours.',
  '03 // KHÔNG CHI PHÍ ẨN': '03 // NO HIDDEN COSTS',
  'Trọn Gói Minh Bạch': 'All-Inclusive Transparent',
  'Giá niêm yết đã bao gồm tiền điện chiếu sáng, điều hòa thông gió, phí an ninh 24/7, bảo trì khóa IoT và vệ sinh hành lang.':
    'Listed rates include lighting, climate ventilation, 24/7 security, IoT lock maintenance, and common area upkeep.',
  'Gói Bảo Hiểm Tài Sản & Cơ Chế Đền Bù Minh Bạch': 'Property Insurance Plan & Transparent Compensation',
  'BẢO TRỢ BỞI CÁC CÔNG TY BẢO HIỂM TÀI SẢN UY TÍN HÀNG ĐẦU': 'UNDERWRITTEN BY TOP LEADING PROPERTY INSURERS',
  'GÓI TIÊU CHUẨN // MIỄN PHÍ': 'STANDARD PLAN // COMPLIMENTARY',
  'Bồi Thường Đến 50 Triệu VNĐ': 'Coverage Up To 50 Million VND',
  'Mỗi buồng kho ký hợp đồng đều được tự động kích hoạt gói bảo hiểm cơ bản lên đến 50.000.000 VNĐ cho rủi ro cháy nổ, ngập úng hoặc sự cố kỹ thuật.':
    'Every signed contract automatically activates basic coverage up to 50,000,000 VND for fire, flood, or technical incident risks.',
  'GÓI MỞ RỘNG // THEO YÊU CẦU': 'EXTENDED PLAN // ON DEMAND',
  'Bảo Vệ Lên Đến 500 Triệu VNĐ': 'Protection Up To 500 Million VND',
  'Dành cho doanh nghiệp hoặc cá nhân cất giữ hàng hóa giá trị cao, thiết bị quang học, máy móc chính xác với mức phí phụ trợ cực kỳ ưu đãi.':
    'Designed for businesses or collectors storing high-value inventory, optics, or precision gear at preferred rates.',
  'QUY TRÌNH BỒI THƯỜNG': 'COMPENSATION PROCESS',
  'Giải Quyết Nhanh Chóng': 'Prompt Settlement',
  'Khi có sự cố khách quan được xác nhận bởi đơn vị giám định độc lập, biên bản bồi thường được giải quyết và chi trả trong vòng 7 - 14 ngày làm việc.':
    'Upon verified incidents by independent adjusters, settlements are processed and disbursed within 7–14 business days.',
  'Thời Hạn Thuê Linh Hoạt, Tự Động Gia Hạn & Chấm Dứt Hợp Đồng Dễ Dàng': 'Flexible Rental Duration, Auto-Renewal & Simple Cancellation',
  'ĐIỀU KHOẢN THỰC HIỆN HỢP ĐỒNG MINH BẠCH VÀ CHỦ ĐỘNG': 'TRANSPARENT & PROACTIVE CONTRACT TERMS',
  'THỜI HẠN TỐI THIỂU': 'MINIMUM TERM',
  'Chỉ Từ 01 Tháng': 'From Just 01 Month',
  'Khách hàng có thể thuê ngắn hạn từng tháng để sửa nhà, đi công tác, hoặc ký dài hạn từ 6 - 12 tháng để nhận chiết khấu lên đến 15%.':
    'Rent short-term by month for renovations/travel, or sign 6–12 months for discounts up to 15%.',
  'GIA HẠN TỰ ĐỘNG': 'AUTO RENEWAL',
  'Thông Báo Trước 5 Ngày': '5-Day Advance Notice',
  'Hệ thống tự động nhắc hạn thanh toán qua Email/SMS 5 ngày trước ngày kết thúc kỳ thuê. Khách hàng dễ dàng thanh toán gia hạn trực tiếp trên ứng dụng.':
    'Automated payment reminders via Email/SMS 5 days before term end. Renew directly through the app.',
  'CHỦ ĐỘNG HỦY HỢP ĐỒNG': 'PROACTIVE TERMINATION',
  'Báo Trước 07 Ngày': '07 Days Notice',
  'Bạn có quyền kết thúc hợp đồng bất kỳ khi nào có nhu cầu, chỉ cần gửi thông báo trước 07 ngày trên portal quản lý mà không phát sinh bất kỳ khoản phí phạt nào.':
    'Terminate contracts whenever needed with just 7 days advance notice in the portal without penalty fees.',
  'Danh Mục Hàng Hóa Nghiêm Cấm & Tiêu Chuẩn An Toàn PCCC': 'Prohibited Goods List & Fire Safety Standards',
  'BẢO VỆ TUYỆT ĐỐI AN TOÀN TÍNH MẠNG VÀ TÀI SẢN TOÀN HỆ THỐNG': 'ENSURING COMPREHENSIVE SAFETY OF LIFE AND PROPERTY',
  'CHẤT DỄ CHÁY NỔ & HÓA CHẤT': 'FLAMMABLES & CHEMICALS',
  'Tuyệt Đối Nghiêm Cấm': 'Strictly Prohibited',
  'Cấm lưu trữ xăng dầu, bình gas, pháo hoa, pin lithium hỏng/lỗi, dung môi sơn, hóa chất ăn mòn và các chất nguy hại dễ bắt lửa.':
    'No gasoline, gas tanks, fireworks, damaged lithium batteries, paint solvents, or flammable corrosives.',
  'HÀNG HÓA BẤT HỢP PHÁP': 'ILLEGAL CONTRABAND',
  'Tuân Thủ Pháp Luật': 'Legal Compliance',
  'Cấm động vật sống, xác động vật, thực phẩm tươi sống dễ ôi thiu phát sinh mùi hôi, vũ khí, hàng lậu hoặc đồ vật vi phạm pháp luật Việt Nam.':
    'No live animals, perishable foods, weapons, contraband, or items prohibited by Vietnamese law.',
  'CƠ CHẾ GIÁM SÁT PCCC': 'FIRE MONITORING SYSTEM',
  'Cảm Biến Khói Nhiệt Tự Động': 'Automatic Smoke & Heat Sensors',
  '100% buồng kho trang bị đầu dò khói nhiệt thông minh kết nối trung tâm PCCC TP. Hồ Chí Minh. Hệ thống phun sương tự động sẵn sàng 24/7.':
    '100% units equipped with smart heat/smoke detectors wired to emergency dispatch. Auto-mist suppression active 24/7.',

  // FAQs
  'Câu Hỏi Thường Gặp & Kênh Hỗ Trợ Khách Hàng': 'Frequently Asked Questions & Support Channels',
  'Giải đáp nhanh những băn khoăn phổ biến nhất của người dùng khi bắt đầu thuê buồng kho tự quản tại Boxora.':
    'Quick answers to the most common questions when renting smart storage with Boxora.',
  'Tất Cả Câu Hỏi': 'All Questions',
  'Hợp Đồng & Chi Phí': 'Contracts & Pricing',
  'Cơ Sở & Vận Chuyển': 'Facilities & Transport',
  'Tôi có thể ra vào buồng kho vào ban đêm hoặc ngày Lễ/Tết không?': 'Can I access my storage unit at night or on holidays?',
  'Hoàn toàn ĐƯỢC. Boxora ứng dụng công nghệ khóa số IoT thông minh độc lập cho từng buồng kho, hoạt động liên tục 24/7/365. Bạn có thể tự do mở cửa buồng kho của mình vào bất kỳ lúc nào lúc nửa đêm, sáng sớm hay ngày Lễ Tết chỉ bằng mã PIN cá nhân hoặc ứng dụng điện thoại mà không cần báo trước hay đợi nhân viên mở cửa.':
    'YES, absolutely. Boxora features independent 24/7 IoT smart locks. You can freely unlock your unit anytime—midnight, dawn, or public holidays—using your private PIN or mobile app without waiting for staff.',
  'Thời hạn thuê kho tối thiểu tại Boxora là bao lâu?': 'What is the minimum rental duration at Boxora?',
  'Thời hạn thuê tối thiểu là 01 tháng. Bạn có thể chọn thuê theo tháng lẻ, theo quý hoặc ký hợp đồng dài hạn 6–12 tháng để nhận mức chiết khấu tiết kiệm từ 5% đến 15% tổng chi phí.':
    'Minimum rental period is 01 month. You can rent month-to-month, quarterly, or sign 6–12 month agreements for 5% to 15% discounts.',
  'Tôi có thể đổi sang buồng kho lớn hơn hoặc nhỏ hơn khi đang thuê không?': 'Can I upgrade or downsize my unit during the rental?',
  'Hoàn toàn thuận tiện. Khách hàng có thể yêu cầu nâng cấp hoặc thu nhỏ buồng kho bất kỳ lúc nào trên Dashboard. Hệ thống sẽ tự động đối soát số dư tiền thuê và tiền cọc còn lại của hợp đồng cũ sang buồng kho mới ngay trong ngày mà không mất phí chuyển đổi buồng.':
    'Very easily. Request an upgrade or downsizing anytime via Dashboard. Unused rent and deposit automatically transfer to the new unit on the same day without transfer fees.',
  'Mã PIN của tôi có bảo mật không? Nhân viên Boxora có biết mã mở khóa không?': 'Is my PIN passcode secure? Do Boxora employees know it?',
  'Mã PIN mở khóa được mã hóa bảo mật trực tiếp trên hệ thống. Nhân viên Boxora không thể xem hoặc can thiệp vào mã PIN cá nhân của bạn. Chỉ duy nhất bạn sở hữu mã và có thể chủ động đổi mã số mới trực tiếp trên điện thoại bất cứ lúc nào.':
    'PIN passcodes are encrypted end-to-end. Staff cannot view or alter your private code. Only you have access, and you can reset your PIN anytime from your phone.',
  'Cơ sở có sẵn xe đẩy hàng và thang nâng hàng hỗ trợ chuyển đồ không?': 'Are cargo trolleys and freight elevators provided on-site?',
  'CÓ. Tất cả các cơ sở Boxora đều trang bị sẵn xe đẩy hàng 4 bánh tải trọng 300kg, xe nâng tay thủy lực và thang tải trọng 2 tấn chuyên dụng tại khu vực đón bốc dỡ hàng, phục vụ khách hàng hoàn toàn miễn phí.':
    'YES. All Boxora locations provide 300kg 4-wheel flatbed trolleys, hydraulic pallet jacks, and 2-ton freight elevators in loading zones free of charge.',
  'CÁC KÊNH KẾT NỐI & HỖ TRỢ TRỰC TIẾP': 'DIRECT SUPPORT & CONTACT CHANNELS',
  'TỔNG ĐÀI KHẨN CẤP': 'EMERGENCY HOTLINE',
  'Trực kỹ thuật IoT và tiếp nhận hỗ trợ sự cố khẩn cấp mọi lúc, mọi nơi.': '24/7 IoT technical response and emergency incident support anytime, anywhere.',
  'HÒM THƯ TIẾP NHẬN': 'INBOX DESK',
  'Phản hồi trong 60 phút': 'Response within 60 minutes',
  'Tiếp nhận yêu cầu hợp đồng doanh nghiệp, hóa đơn VAT và phản hồi ý kiến.': 'Corporate contracts, VAT invoicing, and inquiries desk.',
  'ZALO DOANH NGHIỆP': 'OFFICIAL ZALO OA',
  'Tư vấn viên gửi hình ảnh buồng kho thực tế và hướng dẫn qua tin nhắn tiện lợi.': 'Live agents provide real photos and guided onboarding via messaging.',
  'GIỜ TRỰC TẠI QUẦY': 'ON-SITE FRONT DESK HOURS',
  '08:00 – 20:00 Hàng Ngày': '08:00 – 20:00 Daily',
  'Cả T7, CN & Ngày Lễ': 'Including Weekends & Holidays',
  'Nhân viên trực tiếp đón khách xem buồng kho mẫu và hỗ trợ đóng gói.': 'Front desk staff welcoming unit walkthroughs and packing assistance.',

  // Conversion Banner & Footer
  'Sẵn Sàng Mở Rộng Không Gian Sống Của Bạn?': 'Ready to Expand Your Living & Work Space?',
  'Đặt giữ chỗ trực tuyến ngay hôm nay để nhận mã PIN tự động và bắt đầu lưu kho an toàn trong 60 giây.':
    'Reserve your smart unit online today to get an automated PIN and start storing securely in 60 seconds.',
  'Vào Dashboard Tìm & Thuê Kho': 'Go to Units Explorer & Rent',
  'Hotline 1900-BOXORA': 'Hotline: 1900-BOXORA',
  'Danh Mục Dịch Vụ': 'Services Directory',
  'Chính Sách & Quy Định': 'Policies & Regulations',
  'Hệ Thống 4 Cơ Sở Kho': '4 Storage Facilities Network',
  'Cơ Sở 1 // Boxora Quận 1:': 'Facility 1 // Boxora District 1:',
  'Cơ Sở 2 // Boxora Quận 7 (Nam Sài Gòn):': 'Facility 2 // Boxora District 7 (South Saigon):',
  'Cơ Sở 3 // Boxora Thủ Đức Hub:': 'Facility 3 // Boxora Thu Duc Hub:',
  'Cơ Sở 4 // Boxora Tân Bình Mega Hub:': 'Facility 4 // Boxora Tan Binh Mega Hub:',
  'Câu Hỏi Thường Gặp (FAQs)': 'Frequently Asked Questions (FAQs)',
  'Câu hỏi thường gặp': 'Frequently Asked Questions',

  // Explorer & Units
  'STORAGE EXPLORER': 'STORAGE EXPLORER',
  'Tìm Kiếm & Khám Phá Phòng Kho Boxora': 'Search & Explore Boxora Storage Units',
  'Tìm kiếm phòng kho, kích thước, cơ sở...': 'Search units, dimensions, facilities...',
  'Lọc theo cơ sở': 'Filter by Facility',
  'Tất cả cơ sở': 'All Facilities',
  'Danh mục kho': 'Unit Category',
  'Tất cả': 'All Units',
  'Kho Mini': 'Mini Storage',
  'Kho Cá Nhân': 'Personal Storage',
  'Kho Doanh Nghiệp': 'Business Storage',
  'Kho Đặc Biệt': 'Specialty Storage',
  'Trạng thái': 'Status',
  'Tất cả trạng thái': 'All Statuses',
  'Sẵn sàng': 'Available',
  'Đang thuê': 'Occupied',
  'Bảo trì': 'Maintenance',
  'Khoảng cách gần nhất': 'Closest Distance',
  'Khoảng cách': 'Distance',
  'Giá thuê': 'Rental Rate',
  'Diện tích': 'Area',
  'Thể tích': 'Volume',
  'Kích thước': 'Dimensions',
  'Tháng': 'Month',
  'tháng': 'month',
  'triệu/tháng': 'M VND/month',
  'đ/tháng': 'VND/month',
  'VNĐ/tháng': 'VND/month',
  '₫/tháng': 'VND/month',
  'Xem chi tiết': 'View Details',
  'Thuê ngay': 'Rent Now',
  'Thuê Buồng Kho Này': 'Rent This Unit',
  'Xem bản đồ': 'View Map',
  'Chỉ đường': 'Get Directions',
  'Mã kho': 'Unit Code',
  'Tầng': 'Floor',
  'Loại kho': 'Storage Type',
  'Nhiệt độ hiện tại': 'Current Temperature',
  'Độ ẩm hiện tại': 'Current Humidity',
  'Khóa thông minh IoT': 'IoT Smart Lock',
  'Trạng thái cửa': 'Door Status',
  'Đang đóng bảo mật': 'Securely Closed',
  'Đang mở': 'Open',
  'Xác nhận thuê kho': 'Confirm Unit Rental',
  'Thời hạn thuê': 'Rental Duration',
  '01 tháng': '01 Month',
  '03 tháng': '03 Months',
  '06 tháng': '06 Months',
  '12 tháng': '12 Months',
  'Tiền thuê hàng tháng': 'Monthly Rent',
  'Tiền cọc an toàn': 'Security Deposit',
  'Tổng thanh toán': 'Total Payment',
  'Mã PIN mở app': 'App PIN Passcode',
  'Sao chép': 'Copy',
  'Đã sao chép': 'Copied',
  'Đã xác định vị trí GPS thực tế của bạn!': 'Your real GPS location has been pinpointed!',
  'Không thể lấy vị trí GPS (vui lòng cho phép quyền truy cập vị trí).': 'Unable to acquire GPS location (please allow location permissions).',
  'Vị trí định vị GPS thực tế:': 'Real-time GPS coordinates:',
  'Lấy vị trí GPS': 'Get GPS Location',
  'Vị trí của bạn': 'Your Location',
  'Đang định vị GPS...': 'Acquiring GPS...',

  // UnitsExplorerPage & Filters
  '1. Vị trí của bạn (Điểm xuất phát)': '1. Your Location (Starting Point)',
  '2. Vị trí cơ sở kho muốn thuê': '2. Target Boxora Facility Location',
  'Sắp xếp cự ly': 'Proximity Sorting',
  'Gần tôi nhất': 'Closest to Me',
  'Điểm xuất phát:': 'Starting point:',
  'Tất Cả Cơ Sở Kho Boxora': 'All Boxora Facilities',
  'Chi Nhánh': 'Branches',
  'Cách bạn:': 'Distance:',
  'Tất Cả Phân Hạng': 'All Tiers',
  'Locker Mini (1-3m²)': 'Mini Locker (1-3m²)',
  'Kho Cá Nhân (4-8m²)': 'Personal Storage (4-8m²)',
  'Kho Doanh Nghiệp (10-20m²)': 'Business Storage (10-20m²)',
  'Kho Lạnh Rượu': 'Wine & Climate Storage',
  'Tìm mã kho, đồ đạc...': 'Search unit code, belongings...',
  'Tất cả tình trạng': 'All Statuses',
  'Sẵn sàng (Thuê ngay)': 'Available (Rent Now)',
  'Dạng lưới': 'Grid View',
  'Dạng danh sách': 'List View',
  'Bật để ưu tiên kho gần bạn': 'Enable to sort by closest distance',
  'Đang xếp theo km ngắn nhất': 'Sorted by shortest distance',
  'Tìm kho gần bạn': 'Find storage near you',
  'Nhập địa chỉ hoặc bật vị trí để xem các cơ sở kho gần bạn.': 'Enter an address or use your location to find nearby facilities.',
  'Nhập địa chỉ của bạn': 'Enter your address',
  'Địa chỉ của bạn': 'Your address',
  'Đang tìm…': 'Searching…',
  'Tìm địa chỉ': 'Find address',
  'Dùng vị trí hiện tại của bạn': 'Use your current location',
  'Đang lấy vị trí…': 'Getting your location…',
  'Bật vị trí': 'Use my location',
  'Đang tìm quanh:': 'Searching near:',
  'Nguồn dữ liệu địa chỉ:': 'Address data from:',
  'Cơ sở kho': 'Storage facility',
  'Gần bạn nhất:': 'Nearest to you:',
  'khoảng ': 'about ',
  'Kho tại ': 'Storage at ',
  'Kho gần bạn': 'Nearby storage',
  'Đang ưu tiên kho gần bạn': 'Prioritizing nearby storage',
  'Ưu tiên kho gần bạn': 'Prioritize nearby storage',
  'Các kho gần bạn được hiển thị trước': 'Nearby facilities are shown first',
  'Bật để xem kho gần bạn trước': 'Turn on to show nearby facilities first',
  'Tìm mã kho, loại kho, chi nhánh...': 'Search by unit, type, or facility...',
  'Lọc theo phân hạng': 'Filter by category',
  'Tất cả phân hạng': 'All categories',
  'Locker Mini (1–3 m²)': 'Mini Locker (1–3 m²)',
  'Kho Cá nhân (4–8 m²)': 'Personal Storage (4–8 m²)',
  'Kho Doanh nghiệp (10–20 m²)': 'Business Storage (10–20 m²)',
  'Kho lạnh / đặc biệt': 'Climate-controlled / special storage',
  'Lọc theo loại kho': 'Filter by storage type',
  'Tất cả loại kho': 'All storage types',
  'Lọc theo diện tích kho': 'Filter by unit size',
  'Mọi diện tích': 'Any size',
  'Dưới 3 m²': 'Under 3 m²',
  '3–8 m²': '3–8 m²',
  'Trên 8–15 m²': 'Over 8–15 m²',
  'Trên 15 m²': 'Over 15 m²',
  'Hiện chưa có kho để hiển thị': 'No storage units are available yet',
  'Không tìm thấy kho phù hợp': 'No matching storage units found',
  'Thử đổi loại kho, diện tích, chi nhánh hoặc từ khóa tìm kiếm.': 'Try changing the unit type, size, facility, or search terms.',
  'Gửi yêu cầu thuê': 'Request to rent',
  'GPS của tôi': 'My GPS',
  'Định vị GPS thực tế của bạn': 'Pinpoint your actual GPS location',
  'Đang hiển thị các phòng kho trên toàn hệ thống': 'Displaying units across all facilities in network',
  'Không tìm thấy phòng kho phù hợp': 'No storage units found matching criteria',
  'Vui lòng thử chọn lại phân hạng, cơ sở hoặc xóa từ khóa tìm kiếm để xem các phòng kho khả dụng khác.':
    'Please try selecting a different tier, facility, or clear search keywords to view other available units.',
  'Xem Lại Tất Cả Phòng Kho': 'Reset All Filters',
  'Giữ Chỗ / Thuê': 'Reserve / Rent',
  'Xem chỉ đường': 'Get directions',
  'Sức chứa thực tế:': 'Actual capacity:',
  'Từ:': 'From:',
  'Đối Chiếu Vị Trí & Lộ Trình Di Chuyển': 'Compare Location & Route',
  'Vị trí của bạn (Khách thuê):': 'Your Location (Tenant):',
  'Vị trí kho muốn thuê:': 'Target Unit Facility:',
  'Mở bản đồ chỉ đường': 'Open route in Google Maps',
  'Khách thuê:': 'Tenant:',
  'Thời gian bắt đầu:': 'Start Time:',
  'Quy trình cấp quyền truy cập:': 'Access Provisioning Process:',
  'Ký kết thỏa thuận hợp đồng điện tử tự quản thông minh.': 'Sign smart self-storage electronic contract.',
  'Cấp mã PIN mở cửa tự động 24/7 bảo mật riêng biệt.': 'Receive dedicated 24/7 automated unlock PIN.',
  'Kích hoạt dịch vụ & quyền mở app:': 'Service activation & app access:',
  'Mở toàn quyền quản lý kho trên Cổng khách hàng (Customer Portal).': 'Unlock full storage management on Customer Portal.',
  'Xác Nhận Thuê & Kích Hoạt Mở App': 'Confirm Rental & Activate App',
  'Đang kích hoạt hợp đồng & mở app...': 'Activating contract & app access...',
  'Thuê Kho & Kích Hoạt App Thành Công!': 'Storage Rental & App Activation Successful!',
  'đã được cấp quyền sở hữu.': 'ownership access granted.',
  'Vị trí tại:': 'Located at:',
  'MÃ PIN MỞ CỬA IOT TỰ QUẢN': 'SMART IOT ACCESS PIN',
  'Đã xác nhận quyền mở app & Portal': 'Confirmed app & Portal access',
  'Truy Cập Customer Portal Ngay': 'Access Customer Portal Now',
  'Xác Nhận Kích Hoạt Mở App Thành Công': 'App Access Activation Successful',
  'Thuê Kho & Bàn Giao Mã Kích Hoạt App': 'Rent Storage & Issue Mobile App PIN',
  'Hệ thống kho thông minh Boxora Cloud': 'Boxora Cloud Smart Storage Network',
  'Sao chép mã PIN': 'Copy PIN Code',

  // Floating Contact Widget
  'Chat Zalo tư vấn 24/7': 'Zalo Support Chat 24/7',
  'Tư vấn qua Zalo': 'Consult via Zalo',
  'Hotline: 1900-BOXORA (1900 269 672)': 'Hotline: 1900-BOXORA (1900 269 672)',
  'Gọi hotline 1900-BOXORA': 'Call Hotline 1900-BOXORA',
  'Vị trí cơ sở Boxora': 'Boxora Facility Locations',
  'Xem vị trí 3 cơ sở kho Boxora': 'View Boxora Facilities on Map',
  'Giao diện & Ngôn ngữ': 'Display & Language',

  // Booking Checkout Modal
  'Boxora • Đặt kho an toàn': 'Boxora • Secure Booking',
  'Thanh toán & giữ chỗ': 'Payment & Reservation',
  'Đặt thuê kho': 'Book Storage Rental',
  'Chọn kỳ hạn': 'Choose Duration',
  'Xác nhận': 'Confirmation',
  'Thanh toán': 'Payment',
  'Ngày bắt đầu thuê': 'Start Date',
  'Kỳ hạn thuê': 'Rental Duration',
  'Tiền cọc an toàn (hoàn trả 100%)': 'Security Deposit (100% Refundable)',
  'Tổng thanh toán đợt đầu': 'Total Initial Payment',
  'Phương thức thanh toán': 'Payment Method',
  'Quét mã QR Ngân Hàng': 'Bank Transfer QR Code',
  'Cổng thanh toán VNPay': 'VNPay Payment Gateway',
  'Mở ứng dụng ngân hàng hoặc ví điện tử để quét mã': 'Open banking app or e-wallet to scan QR code',
  'Hết hạn thanh toán sau:': 'Payment expires in:',
  'Tôi đã hoàn tất chuyển khoản': 'I have completed the transfer',
  'Đang xác thực giao dịch...': 'Verifying transaction...',
  'Giao dịch thành công!': 'Transaction Successful!',
  'Mã đặt kho:': 'Booking Code:',
  'Mã PIN mở khóa tạm thời:': 'Temporary Access PIN:',

  // Modals & Settings
  'Hồ sơ tài khoản': 'Account Profile',
  'Chỉnh sửa hồ sơ': 'Edit Profile',
  'Chỉnh Sửa Hồ Sơ': 'Edit Profile',
  'Tài khoản & Bảo mật': 'Account & Security',
  'Hồ sơ cá nhân và mật khẩu': 'Profile and password',
  'Chủ đề, phông chữ, ngôn ngữ': 'Theme, fonts, language',
  'Cập nhật họ tên, số điện thoại': 'Update full name, phone number',
  'Cập nhật thông tin cá nhân': 'Update personal details',
  'Cài đặt web & hệ thống': 'Web & System Settings',
  'Cài Đặt Trang Web & Vận Hành': 'Website Settings & Ops',
  'Cài đặt giao diện & hệ thống': 'Appearance & System Settings',
  'Tùy chỉnh trải nghiệm làm việc theo nhu cầu cá nhân': 'Personalize your interface and workspace experience',
  'Chủ đề, âm thanh, cảnh báo IoT': 'Theme, alert sounds, IoT alerts',
  'Chủ đề, thông báo & cảnh báo IoT': 'Theme, notifications & IoT alerts',
  'Thông báo & Cảnh báo hệ thống': 'System Notifications & Alerts',
  'Chủ đề, còi báo, phông chữ': 'Theme, alarm tone, fonts',
  'Giao diện, còi báo, ngôn ngữ': 'Theme, alarms, language',
  'Tùy chỉnh nhanh': 'Quick Settings',
  'Giao diện tối': 'Dark Mode',
  'Giao diện sáng': 'Light Mode',
  'Chuyển sang giao diện sáng': 'Switch to Light Mode',
  'Chuyển sang giao diện tối': 'Switch to Dark Mode',
  'Âm thanh còi kho': 'Warehouse Alarm Sound',
  'Âm thanh cảnh báo khẩn': 'Emergency Siren Sound',
  'Thông báo IoT & Sự kiện': 'IoT Alerts & Events',
  'Thông báo trình duyệt & IoT': 'Browser & IoT Notifications',
  'Ngôn ngữ': 'Language',
  'Ngôn ngữ hiển thị': 'Display Language',
  'Kết thúc phiên làm việc': 'End work session',
  'Kết thúc phiên làm việc an toàn': 'Securely terminate session',
  'Người dùng': 'User',
  'Người dùng hiện tại': 'Current User',
  'Tài khoản': 'Account',
  'Tài khoản cá nhân': 'Personal Account',
  'Chưa cập nhật email': 'No email provided',
  'Họ và tên': 'Full Name',
  'Số điện thoại': 'Phone Number',
  'Địa chỉ': 'Address',
  'Đổi mật khẩu': 'Change Password',
  'Mật khẩu': 'Password',
  'Mật khẩu hiện tại': 'Current Password',
  'Mật khẩu mới': 'New Password',
  'Xác nhận mật khẩu': 'Confirm Password',
  'Xác nhận mật khẩu mới': 'Confirm New Password',
  'Lưu thay đổi': 'Save Changes',
  'Đang lưu...': 'Saving...',

  // Logout Confirm Modal
  'Xác nhận đăng xuất': 'Confirm Logout',
  'Kết thúc phiên làm việc hiện tại trên Boxora': 'End active session on Boxora',
  'Bạn có chắc chắn muốn đăng xuất không? Phiên đăng nhập sẽ được thu hồi an toàn. Bạn sẽ cần nhập lại thông tin để tiếp tục sử dụng hệ thống.':
    'Are you sure you want to log out? Your session will be safely terminated and you will need to sign in again to continue.',
  'Hủy bỏ': 'Cancel',
  'Hủy': 'Cancel',
  'Đang xử lý...': 'Processing...',
  'Đang tải...': 'Loading...',
  'Đang kết nối hệ thống Boxora...': 'Connecting to Boxora system...',
  'Đã lưu': 'Saved',
  'Giao diện (Chủ đề màu sắc)': 'Theme (Color Palette)',
  'Sáng': 'Light',
  'Giao diện trắng tiêu chuẩn': 'Clean standard light theme',
  'Tối': 'Dark',
  'Dịu mắt ban đêm': 'Gentle on eyes at night',
  'Tự động': 'System',
  'Theo hệ điều hành': 'Sync with operating system',
  'Kích thước phông chữ': 'Font Scaling',
  'Tiêu chuẩn (100%)': 'Standard (100%)',
  'Tối ưu sơ đồ & bảng dữ liệu': 'Optimized for floorplans & tables',
  'Dễ đọc (+10%)': 'Comfort (+10%)',
  'Cỡ chữ lớn hơn cho màn hình xa': 'Larger text for large displays',
  'Âm thanh & Cảnh báo kho': 'Sound & Warehouse Alerts',
  'Nghe thử': 'Play Test',
  'Âm thanh cảnh báo khẩn cấp': 'Emergency Siren Tone',
  'Phát còi khi cảm biến nhiệt độ / khói vượt ngưỡng': 'Sound siren when temperature or smoke alarms trigger',
  'Âm lượng còi:': 'Siren Volume:',
  'Bật thông báo đẩy trạng thái mở khóa và hợp đồng': 'Push alerts for unlock status and contracts',
  'Tiếng Việt': 'Vietnamese',
  'Tiếng Anh': 'English',
  'Ngôn ngữ mặc định hệ thống': 'Default platform language',
  'English': 'English',
  'Global English interface': 'Global English interface',
  'Ghi nhớ phiên đăng nhập an toàn': 'Remember Secure Session',
  'Duy trì trạng thái làm việc khi đóng trình duyệt': 'Stay logged in across browser restarts',
  'Khôi phục mặc định': 'Restore Defaults',
  'Đóng': 'Close',
  'Lưu & Áp dụng': 'Save & Apply',

  // Role labels
  'Quản trị viên Hệ thống': 'System Administrator',
  'Giám đốc Vận hành': 'Operations Director',
  'Quản lý Cơ sở': 'Facility Manager',
  'Nhân viên Quầy': 'Front Desk Staff',
  'Khách hàng Thuê kho': 'Storage Customer',
  'Khách Hàng': 'Customer',
  'Khách hàng': 'Customer',
  'Nhân viên': 'Staff',
  'Quản trị viên': 'Administrator',
  'ADMIN': 'ADMIN',
  'STAFF': 'STAFF',
  'FACILITY_MANAGER': 'FACILITY MANAGER',
  'BUSINESS_MANAGER': 'BUSINESS MANAGER',
  'CUSTOMER': 'CUSTOMER',

  // Navigation Links & Portal
  'TỔNG QUAN HỆ THỐNG': 'SYSTEM OVERVIEW',
  'BÁO CÁO DOANH THU': 'REVENUE REPORTS',
  'SƠ ĐỒ CƠ SỞ KHO': 'FACILITY LAYOUT',
  'CHÍNH SÁCH GIÁ & CHI NHÁNH': 'PRICING & FACILITY POLICIES',
  'VẬN HÀNH QUẦY BÀN GIAO': 'DESK OPERATIONS',
  'BÁO CÁO THU NGÂN': 'CASHIER JOURNAL',
  'XỬ LÝ SỰ CỐ TẠI CHỖ': 'ON-SITE TICKETS',
  'XỬ LÝ NỢ CƯỚC QUÁ HẠN': 'OVERDUE DELINQUENCY',
  'XỬ LÝ TRỰC CA': 'SHIFT ROSTER',
  'Báo Cáo Doanh Thu, Dòng Tiền Cơ Sở & Thu Ngân': 'Facility Revenue, Cashflow & Cashier Journal',
  'DANH SÁCH PHÒNG KHO': 'STORAGE UNITS',
  'HỢP ĐỒNG & THANH TOÁN': 'CONTRACTS & BILLING',
  'Trạng Thái Hệ Thống': 'System Status',
  'Hệ thống trực tuyến': 'System Online',
  'Kết nối máy chủ ổn định': 'Stable Server Connection',
  'An Ninh Kho': 'Facility Security',
  'Khóa bảo mật: Hoạt động': 'Smart Lock: Active',
  'Hỗ trợ khách: 1900 6828': 'Support: 1900 6828',
  'Mở bảng phân công cơ sở': 'Facility Assignment Scoping',
  'Cơ sở trực thuộc': 'Assigned Facility',
  'Toàn hệ thống (Tất cả cơ sở)': 'All Facilities System',
  'TẤT CẢ CƠ SỞ': 'ALL FACILITIES',
  'Sơ đồ kho Tầng 1 & 2': 'Floorplan Level 1 & 2',

  // Action Buttons & Form Fields
  'Tìm kiếm': 'Search',
  'Lọc': 'Filter',
  'Lưu': 'Save',
  'Xóa': 'Delete',
  'Thành công': 'Success',
  'Thất bại': 'Failed',
  'Chi tiết': 'Details',
  'Xem thêm': 'View More',
  'Quay lại': 'Go Back',
  'Tiếp tục': 'Continue',
  'Hoàn tất': 'Complete',
  'Áp dụng': 'Apply',
  'Mở cửa': 'Unlock Door',
  'Khóa cửa': 'Lock Door',
  'Lịch sử mở cửa': 'Access Log',
  'Gia hạn hợp đồng': 'Renew Contract',
  'Thanh toán ngay': 'Pay Now',
  'Xuất hóa đơn': 'Export Invoice',
  'Nhắn tin Zalo tư vấn ngay': 'Message via Official Zalo',
  'Hotline khẩn cấp 1900-BOXORA': 'Emergency Hotline 1900-BOXORA',
  'Xem 4 cơ sở & chỉ đường': 'View 4 Facilities & Directions',
  'Chọn ngôn ngữ': 'Select language',
}

// Reservation dashboard copy used on both the landing page and customer portal.
Object.assign(DICTIONARY, {
  "Mã đặt chỗ của bạn:": "Your booking reference:",
  "#": "#",
  "Mã kho giữ chỗ:": "Unit held:",
  "Cơ sở trực thuộc:": "Facility:",
  "Thời hạn hợp đồng:": "Contract duration:",
  "ngày (": "days (",
  "→": "→",
  ")": ")",
  "Lịch hẹn nhận kho:": "Scheduled move-in:",
  "Hạn giữ chỗ:": "Reservation hold expires:",
  "Trạng thái thanh toán:": "Payment status:",
  "Phương thức:": "Method:",
  "Xem Danh Sách Đặt Chỗ": "View reservations",
  "Đến Kho Của Tôi": "Go to My Storage",
  "Quay lại tìm kho": "Back to unit search",
  "Đặt giữ chỗ kho": "Reserve a storage unit",
  "Mã kho:": "Unit:",
  "·": "·",
  "✕": "✕",
  "Diện tích:": "Area:",
  "m²": "m²",
  "· Vị trí:": "· Floor:",
  "₫": "VND",
  "/tháng": "/month",
  "Giá niêm yết, chưa áp dụng ưu đãi kỳ hạn": "List price; term discounts not applied",
  "1. Chọn thời hạn thuê": "1. Choose a rental term",
  "Chọn kỳ hạn phù hợp với nhu cầu lưu trữ của bạn.": "Choose a term that fits your storage needs.",
  "Nhập số ngày muốn thuê:": "Enter rental days:",
  "ngày (tương đương ~": "days (about",
  "tháng hợp đồng)": "months per contract)",
  "loyalty": "loyalty",
  "Ưu đãi kỳ hạn · Chiết khấu theo thời hạn": "Term discount and savings for longer rentals",
  "Mức giảm giá được áp dụng theo chính sách giá hiện hành của hệ thống Boxora cho các kỳ hạn đủ điều kiện (từ 3 tháng giảm 5%, từ 6 tháng giảm 10%, từ 12 tháng giảm 15%, từ 24 tháng giảm 20%). Giá và chiết khấu cuối cùng được máy chủ xác nhận theo thời gian thực.": "Discounts follow Boxora's current pricing policy for eligible terms (5% from 3 months, 10% from 6 months, 15% from 12 months, and 20% from 24 months). The server confirms the final price and discount in real time.",
  "2. Chọn lịch hẹn nhận kho & Lịch thuê": "2. Choose a move-in appointment & Rental period",
  "Kiểm tra kỹ ngày hẹn nhận kho và ngày bắt đầu hợp đồng trước khi xác nhận.": "Review the move-in appointment and contract start date before confirming.",
  "Ngày bắt đầu thuê chính thức": "Official rental start date",
  "Ngày bắt đầu thuê chính thức được xác lập khi hoàn tất bàn giao thực tế và hợp đồng có hiệu lực.": "The official rental start date is set when handover is completed and the contract takes effect.",
  "Lịch hẹn check-in dự kiến": "Estimated check-in appointment",
  "09:00": "09:00",
  "13:00": "13:00",
  "15:00": "15:00",
  "Ngày hẹn nhận kho không mặc nhiên là ngày bắt đầu thuê chính thức.": "The scheduled move-in date is not automatically the official rental start date.",
  "Ngày kết thúc thuê dự kiến:": "Expected rental end date:",
  "Được tính theo kỳ hạn và quy tắc tính thời hạn trong hợp đồng từ máy chủ": "Calculated from the term and contract duration rules provided by the server",
  "info": "info",
  "Ngày check-in sau ngày bắt đầu thuê": "Check-in is after the rental start date",
  "Hợp đồng dự kiến bắt đầu trước ngày bạn nhận kho. Vui lòng xác nhận chính sách tính tiền cho khoảng thời gian chênh lệch trước khi ký. Hệ thống không tự động tính thêm phụ phí ngoài hợp đồng.": "The contract is expected to start before your move-in date. Review the billing policy for this gap before signing. No extra fee is added unless stated in the contract.",
  "Trạng thái mã PIN SmartLock": "Smart lock PIN status",
  "Chưa kích hoạt": "Not activated",
  "Mã PIN chỉ có hiệu lực khi hợp đồng, thanh toán và thủ tục bàn giao đáp ứng đủ điều kiện theo chính sách. Thanh toán thành công không đồng nghĩa với việc mã PIN đã hoạt động.": "The PIN is valid only after the contract, payment, and handover meet policy requirements. Successful payment does not mean the PIN is active.",
  "3. Bảng tính chi phí dự kiến": "3. Estimated rental costs",
  "Đang đồng bộ báo giá máy chủ...": "Syncing the server quote...",
  "error": "error",
  "Không thể tải báo giá và chính sách từ máy chủ": "Unable to load the server quote and pricing policies",
  "Thử lại": "Retry",
  "Tiền thuê trước ưu đãi": "Rent before discount",
  "tháng ×": "months ×",
  "Chiết khấu kỳ hạn": "Term discount",
  "Tiền thuê sau ưu đãi": "Rent after discount",
  "Tiền thuê thực tế phải trả cho toàn bộ kỳ hạn": "Rent due for the full rental term",
  "Tiền cọc an ninh": "Security deposit",
  "Khoản bảo đảm tài sản theo quy định cơ sở (hoàn trả 100% khi thanh lý hợp đồng)": "Asset security deposit required by the facility (100% refundable when the contract ends)",
  "Tổng chi phí dự kiến": "Estimated total due",
  "Bao gồm tiền thuê sau ưu đãi + tiền cọc an ninh": "Includes discounted rent + security deposit",
  "Ghi chú: Đơn giá đã bao gồm VAT và dịch vụ tiêu chuẩn của Boxora. Tiền cọc an ninh được bảo lưu riêng biệt và không tính gộp vào tiền thuê. Số tiền thanh toán thực tế phụ thuộc vào phương thức tiếp nhận đã chọn bên dưới.": "Note: The listed price includes VAT and standard Boxora services. The security deposit is held separately and is not included in rent. The amount due depends on the selected reservation method.",
  "4. Chọn phương thức tiếp nhận & đặt chỗ": "4. Choose how to receive your unit & reserve",
  "Chọn hình thức hoàn tất thủ tục phù hợp với thời gian của bạn.": "Choose the process that fits your schedule.",
  "bookmark": "bookmark",
  "Phương thức A — Giữ chỗ theo lịch hẹn": "Option A — Reserve for an appointment",
  "Miễn phí giữ chỗ": "Free reservation",
  "Bảo lưu vị trí kho riêng cho bạn đến giờ hẹn (": "Your unit will be held until your appointment (",
  "lúc": "at",
  ") và cộng thêm": ") plus",
  "giờ gia hạn theo chính sách cơ sở.": "hours of grace under facility policy.",
  "Quy trình tại cơ sở: Đến xem kho thực tế, ký biên bản bàn giao tại quầy và thanh toán cọc + tiền thuê nhận mã SmartLock.": "On-site process: Inspect the unit, sign the handover record at the counter, and pay the deposit and rent to receive the SmartLock code.",
  "Thanh toán ngay": "Due now",
  "0 ₫ (Thanh toán tại quầy)": "0 VND (Pay at the counter)",
  "history_edu": "history_edu",
  "Phương thức B — Ký online & thanh toán": "Option B — Sign online & pay",
  "Ký điện tử & Thanh toán trực tuyến": "Electronic signature & online payment",
  "Xem điều khoản hợp đồng điện tử, xác nhận thông tin và thanh toán trực tuyến tiền cọc cùng cước phí qua cổng thanh toán bảo mật.": "Review the electronic contract, confirm your details, and pay the deposit and rent through the secure payment gateway.",
  "Quy trình: Ký trực tuyến qua hệ thống Boxora, thanh toán xác nhận tức thì, nhân viên chỉ bàn giao mã mở kho khi đến nhận.": "Process: Sign through Boxora, complete verified payment, and receive the access code from staff when you arrive.",
  "Số tiền đến hạn thanh toán": "Amount due",
  "Không thể hoàn tất đặt chỗ:": "Unable to complete the reservation:",
  "Tôi xác nhận đã đọc, hiểu rõ và đồng ý với các nội dung: (1) Kỳ hạn thuê đã chọn; (2) Ngày check-in và cách xác lập ngày bắt đầu thuê chính thức tại thời điểm bàn giao; (3) Chi phí dự kiến và tiền cọc an ninh; (4) Chính sách bảo lưu giữ chỗ của cơ sở; (5) Điều kiện hủy đơn và hoàn tiền cọc.": "I confirm that I have read and agree to: (1) the selected rental term; (2) the move-in date and how the official rental start date is set at handover; (3) estimated costs and the security deposit; (4) the facility reservation policy; and (5) cancellation and deposit refund terms.",
  "Hủy bỏ": "Cancel",
  "Đang xử lý đặt chỗ...": "Processing reservation...",
  "Xác nhận giữ chỗ": "Confirm free reservation",
  "Xác nhận ký online & thanh toán": "Continue to online signing & payment",
  "Không thể tải báo giá và chính sách giá từ máy chủ.": "Could not load the server quote and pricing policies.",
  "Không thể tải báo giá từ máy chủ.": "Could not load the server quote.",
  "Áp dụng đơn giá tháng tiêu chuẩn": "Standard monthly rate applies.",
  "Gói lưu trữ ngắn hạn 15 ngày (áp dụng mức cam kết tối thiểu 1 tháng theo chính sách cơ sở)": "Short-term storage package: 15 days (minimum one-month commitment under facility policy)",
  "Tiêu chuẩn thanh toán linh hoạt theo từng tháng": "Flexible month-to-month billing",
  "Giảm 5% khi cam kết thuê từ 3 tháng": "5% discount for a commitment of 3 months or more",
  "Giảm 10% khi cam kết thuê từ 6 tháng": "10% discount for a commitment of 6 months or more",
  "Giảm 15% khi cam kết thuê gói năm (12 tháng)": "15% discount for an annual term (12 months)",
  "Giảm 20% khi cam kết thuê dài hạn 2 năm (24 tháng)": "20% discount for a 2-year term (24 months)",
  "Giảm 20% thời hạn tùy chỉnh từ 2 năm trở lên": "20% discount for a custom term of 2 years or more",
  "Giảm 15% thời hạn tùy chỉnh từ 1 năm trở lên": "15% discount for a custom term of 1 year or more",
  "Giảm 10% thời hạn tùy chỉnh từ 6 tháng trở lên": "10% discount for a custom term of 6 months or more",
  "Giảm 5% thời hạn tùy chỉnh từ 3 tháng trở lên": "5% discount for a custom term of 3 months or more",
  "Đơn giá tiêu chuẩn theo số tháng thực tế": "Standard rate based on the actual number of months",
  "Vui lòng đánh dấu xác nhận bạn đã đọc và đồng ý với các chính sách đặt giữ chỗ kho trước khi tiếp tục.": "Please confirm that you have read and agree to the storage reservation policies before continuing.",
  "Không thể hoàn tất đơn đặt chỗ do chưa tải được báo giá chính thức từ máy chủ. Vui lòng bấm \"Thử lại\".": "The reservation cannot continue until the official server quote loads. Select Retry and try again.",
  "Hệ thống không trả về mã đơn đặt kho hợp lệ.": "The system did not return a valid reservation reference.",
  "Không thể tạo đơn đặt kho. Ngăn kho này có thể vừa được đặt hoặc đang có người giữ chỗ.": "Could not reserve this unit. It may have just been booked or held by another customer.",
  "Cổng VNPay không phản hồi đường dẫn thanh toán.": "The VNPay gateway did not return a payment link.",
  "Không thể khởi tạo giao dịch VNPay. Vui lòng thử lại.": "Could not start the VNPay transaction. Please try again.",
  "Hệ thống không trả về thông tin xác nhận.": "The system did not return reservation confirmation details.",
  "Không thể giữ chỗ kho này. Vui lòng kiểm tra lại.": "Could not reserve this unit. Please check the details and try again.",
  "Đặt Giữ Chỗ Kho Thành Công!": "Reservation confirmed!",
  "Khởi Tạo Hợp Đồng Thuê Thành Công!": "Online rental request started!",
  "Đã ghi nhận": "Recorded",
  "Sau giờ hẹn 24 giờ (Theo chính sách cơ sở)": "24 hours after the appointment (facility policy)",
  "Chưa thanh toán (Thanh toán tại quầy cơ sở)": "Unpaid (pay at the facility)",
  "Chờ xác nhận thanh toán": "Awaiting payment confirmation",
  "Giữ chỗ miễn phí theo lịch hẹn (Ký & thanh toán tại quầy)": "Free appointment reservation (sign and pay at the facility)",
  "Ký điện tử & Thanh toán online": "Electronic signature & online payment",
  "Vị trí kho đã được bảo lưu riêng cho bạn đến lịch hẹn và thời gian gia hạn theo chính sách. Quý khách vui lòng đến trực tiếp cơ sở để xem kho thực tế, ký biên bản và thanh toán nhận bàn giao.": "Your unit is reserved until the appointment, including the policy grace period. Visit the facility to inspect the unit, sign the handover record, and pay before receiving access.",
  "Hợp đồng điện tử và yêu cầu thanh toán đã sẵn sàng. Mã PIN sẽ được kích hoạt sau khi hoàn tất thủ tục bàn giao theo quy định.": "The electronic contract and payment request are ready. Your access PIN will activate after the required handover is complete.",
  "Đóng": "Close",
  "15 ngày": "15 days",
  "1 tháng": "1 month",
  "3 tháng": "3 months",
  "6 tháng": "6 months",
  "12 tháng": "12 months",
  "24 tháng": "24 months",
  "Tùy chỉnh": "Custom",
  "Chưa đủ điều kiện hưởng chiết khấu kỳ hạn (từ 3 tháng trở lên)": "Select a term",
})

// Keep punctuation and unit symbols unchanged when translating reservation labels.
const reservationArrow = String.fromCharCode(0x2192)
const reservationDot = String.fromCharCode(0x00b7)
const reservationCross = String.fromCharCode(0x2715)
const reservationMeters = 'm' + String.fromCharCode(0x00b2)
const reservationDong = String.fromCharCode(0x20ab)
const reservationMultiply = String.fromCharCode(0x00d7)
Object.assign(DICTIONARY, {
  [reservationArrow]: reservationArrow,
  [reservationDot]: reservationDot,
  [reservationCross]: reservationCross,
  [reservationMeters]: reservationMeters,
  [reservationDong]: 'VND',
  [reservationDot + ' Floor:']: reservationDot + ' Floor:',
  ['months ' + reservationMultiply]: 'months ' + reservationMultiply,
})

const reservationFloorKey = Object.keys(DICTIONARY).find(key => key.startsWith(reservationDot + ' ') && DICTIONARY[key].includes('Floor:'))
if (reservationFloorKey) DICTIONARY[reservationFloorKey] = reservationDot + ' Floor:'
const reservationTermKey = Object.keys(DICTIONARY).find(key => key.startsWith('th?ng ') && DICTIONARY[key].startsWith('months '))
if (reservationTermKey) DICTIONARY[reservationTermKey] = 'months ' + reservationMultiply
DICTIONARY['T'+String.fromCodePoint(0x1ea7)+'ng '] = 'Floor '

// ============================================================================
// COMPREHENSIVE DASHBOARD, STAFF, WORKBENCH, FINANCE & OPERATIONS TRANSLATIONS
// ============================================================================
Object.assign(DICTIONARY, {
  // Staff Workbench & Handover Flow
  'Bàn Vận Hành Quầy & Tiếp Đón': 'Front Desk & Reception Operations',
  'Bàn vận hành quầy & tiếp đón': 'Front desk & reception operations',
  'Ca làm': 'My Shifts',
  'Quy Trình Check-in & Nghiệm Thu Bàn Giao Kho': 'Check-in & Handover Acceptance Workflow',
  'Chuẩn hóa 4 điều kiện tiên quyết BR-RULE-005, nghiệm thu 5 điểm, lưu trữ ảnh hiện trường và cấp mã PIN bảo mật.':
    'Standardize 4 prerequisites (BR-RULE-005), 5-point inspection, on-site photo records, and secure PIN provisioning.',
  'Chuẩn hóa 3 điều kiện tiên quyết BR-RULE-005, nghiệm thu 5 điểm, lưu trữ ảnh hiện trường và cấp mã PIN bảo mật.':
    'Standardize 3 prerequisites (BR-RULE-005), 5-point inspection, on-site photo records, and secure PIN provisioning.',
  'Lịch Hẹn Bàn Giao Trong Ngày': "Today's Move-in Appointments",
  'Lịch Hẹn Nhận Kho Trong Ca': 'Shift Move-in Appointments',
  'Lịch Hẹn Nhận Kho': 'Move-in Appointments',
  'Chờ Bàn Giao': 'Pending Handover',
  'Chờ Nghiệm Thu Trả Kho': 'Pending Return Acceptance',
  'Sự Cố Ưu Tiên Cao': 'High Priority Incidents',
  'lịch hẹn trong ca': 'appointments in shift',
  'lượt khách đang chờ': 'guests waiting',
  'đơn cần kiểm tra điều kiện': 'orders pending prerequisite verification',
  'Đối soát hợp đồng, thanh toán và giấy tờ trước bàn giao': 'Verify contract, payment, and ID before handover',
  'hợp đồng đến hạn': 'expiring contracts',
  'Hồ sơ thuê cần thẩm định thực địa & hoàn cọc': 'Rentals requiring field appraisal & deposit refund',
  'khách đã thanh toán tiền cọc': 'customers with deposit paid',
  'ca mức độ Cao': 'high-priority incidents',
  'ticket đang mở': 'open tickets',
  'Danh sách tiếp đón khách hàng đến nhận kho trực tiếp tại cơ sở trong ca làm việc.': 'Reception list of customers arriving at the facility during the shift.',
  'Đối Soát 4 Điều Kiện': 'Prerequisite Audit (4 Conditions)',
  'Nghiệm Thu Hiện Trường (5/5) & Ảnh': 'Field Inspection (5/5) & Photos',
  'Cấp Mã PIN & Bàn Giao': 'Issue PIN Code & Handover',
  '4 Điều Kiện Tiên Quyết Bàn Giao (BR-RULE-005)': '4 Handover Prerequisites (BR-RULE-005)',
  'Hợp đồng hợp lệ & đã ký': 'Valid & signed contract',
  'Tiền cọc an toàn & Tiền thuê': 'Security deposit & rental fee',
  'Đối soát CCCD & Thẻ cứng': 'ID card & access card verification',
  'Khóa SmartLock & Phòng kho sẵn sàng': 'SmartLock & unit readiness',
  '1. Cửa cuốn & Ray trượt': '1. Roller door & slide tracks',
  '2. Vệ sinh kho & Sàn': '2. Unit & floor cleanliness',
  '3. Khóa SmartLock & Phụ kiện': '3. SmartLock & accessories',
  '4. Môi trường kho thực tế': '4. Real ambient environment',
  '5. Tường & kết cấu buồng kho': '5. Wall and structural condition',
  '5. Wall and structural condition': '5. Wall and structural condition',
  'Tốt / Bình thường': 'Good / Normal',
  'Móp nhẹ / Trầy xước': 'Minor dent / Scratches',
  'Kẹt ray / Hỏng nặng': 'Track jammed / Severe damage',
  'Sạch sẽ / Đã dọn rác': 'Clean / Cleared out',
  'Còn rác / Cần vệ sinh': 'Littered / Cleaning required',
  'Bẩn nhiều / Ẩm mốc': 'Heavy dirt / Mildew',
  'Bình thường / Đủ phụ kiện': 'Normal / Accessories intact',
  'Hỏng chốt an toàn': 'Damaged latch',
  'Mất khóa / Lỗi điện tử': 'Missing lock / Electronic error',
  'Khô ráo, thông thoáng': 'Dry, well-ventilated',
  'Cần bảo dưỡng quạt': 'Fan maintenance needed',
  'Có dấu hiệu ẩm ướt': 'Signs of moisture',
  'Không biến dạng / Tốt': 'No visible damage / Good',
  'No visible damage': 'No visible damage',
  'Móp méo / Hư hại': 'Visible damage / Deformed',
  'Visible damage': 'Visible damage',
  'Ghi chú thẩm định hiện trường khác...': 'Additional inspection notes...',
  'Ảnh Chụp Hiện Trường (Tải từ thiết bị)': 'On-site Evidence Photos (Upload from device)',
  'Toàn cảnh kho': 'Unit panoramic',
  'Khóa & Cửa kho': 'Lock & Door',
  'Tiền cọc ban đầu đã thanh toán:': 'Initial deposit paid:',
  'Đề xuất khấu trừ (VND):': 'Proposed deduction (VND):',
  'Lý do khấu trừ (vd: Phí vệ sinh sàn kho)...': 'Deduction reason (e.g. Floor cleaning fee)...',
  'Số tiền cọc dự kiến hoàn trả:': 'Estimated deposit refund:',
  '* Nhân viên quầy lập biên bản nghiệm thu hiện trường và đề xuất hoàn cọc. Giao dịch hoàn tiền sẽ do Quản lý cơ sở / Kế toán phê duyệt.':
    '* Front desk staff records field inspection and proposes refund. Refund disbursement is approved by Facility Manager / Accountant.',
  'Đã lưu biên bản nghiệm thu': 'Inspection record saved',
  'Return inspection saved': 'Return inspection saved',
  'Đang lưu biên bản…': 'Saving inspection…',
  'Saving inspection…': 'Saving inspection…',
  'Lưu biên bản nghiệm thu trả kho': 'Save return inspection',
  'Save return inspection': 'Save return inspection',
  'ĐÃ LẬP BIÊN BẢN & ĐỀ XUẤT': 'PROPOSAL RECORDED',
  'Đang Lưu Biên Bản...': 'Saving Proposal...',
  'Lập Biên Bản Nghiệm Thu & Đề Xuất Hoàn Cọc': 'Record Inspection & Propose Deposit Refund',
  'Nghiệm Thu Trả Kho': 'Return Unit Inspection',
  'Hợp Đồng Nghiệm Thu': 'Inspection Contract',
  'Hiện không có hợp đồng nào đến hạn nghiệm thu trả kho.': 'No contracts currently due for return inspection.',
  'Hạng mục kiểm tra hiện trường': 'Field inspection checklist',
  'Đánh giá thực tế': 'Actual assessment',
  'Đã nhận kho (ACTIVE)': 'Checked in (ACTIVE)',
  'Đã hoàn tất ca tiếp đón': 'Reception completed',
  '🏢 Ký Trực Tiếp Tại Kho': '🏢 Sign On-site at Facility',
  '✍️ Ký Điện Tử Trực Tuyến': '✍️ Sign Electronically Online',
  'Ký Trực Tiếp Tại Quầy': 'Sign On-site at Counter',
  'Ký Online Qua Hệ Thống': 'Sign Online via Portal',
  'Tra cứu booking': 'Lookup booking',
  'Hướng dẫn nghiệp vụ': 'Operational guide',
  'Tìm kiếm nhanh tên khách hàng, SĐT, mã đặt chỗ #RES-XXXX, hoặc mã số kho...':
    'Quickly search customer name, phone, booking ref #RES-XXXX, or unit code...',
  'Tất cả tầng': 'All floors',
  'Khung giờ:': 'Shift time:',
  'Ca Hiện Tại': 'Current Shift',
  'Trọn Vẹn Hôm Nay': 'Full Day Today',
  'Tất Cả Lịch Hẹn': 'All Appointments',
  'Check-in Vào ca': 'Shift Check-in',
  'Check-out Kết thúc ca': 'Shift Check-out',
  'Bàn giao ca': 'Shift Handover',
  'Xin đổi ca': 'Request Shift Swap',
  'Đang trực ca': 'On Duty',
  'Đã kết thúc ca': 'Shift Ended',
  'Chưa vào ca': 'Not Checked In',
  'Không đi làm': 'Absent',
  'Hôm nay không có lịch trực ca': 'No shift scheduled today',
  'Giám sát quản trị viên (Không trực ca)': 'Admin Oversight (No shift assignment)',
  'Tài khoản đăng nhập:': 'Signed-in account:',
  'Phân khu:': 'Assigned zone:',
  'Hạn trả:': 'Return deadline:',

  // Shift Roster
  'Xử Lý Trực Ca & Điều Phối Nhân Sự': 'Shift Roster & Staff Scheduling',
  'Xử lý trực ca': 'Shift roster',
  'Xử Lý Trực Ca': 'Shift Roster',
  'Điều phối ca trực quầy tiếp đón, kiểm tra buồng kho, chấm công vào/ra ca, đổi ca và biên bản bàn giao':
    'Manage reception desk shifts, unit rounds, attendance check-in/out, shift swaps, and handovers',
  'Tổng nhân sự cơ sở': 'Total Facility Staff',
  'Nhân viên thuộc biên chế chi nhánh này': 'Staff assigned to this facility',
  'Phân công ca mới': 'Assign New Shift',
  'Ca Sáng': 'Morning Shift',
  'Ca Chiều': 'Afternoon Shift',
  'Ca Đêm': 'Night Shift',
  'Cả Ngày': 'All Day',
  'Ca sáng: 06:00 - 14:00': 'Morning shift: 06:00 - 14:00',
  'Ca chiều: 14:00 - 22:00': 'Afternoon shift: 14:00 - 22:00',
  'Ca đêm: 22:00 - 06:00': 'Night shift: 22:00 - 06:00',
  'Lịch Phân Công Ca Trực': 'Shift Assignment Schedule',
  'Yêu Cầu Đổi Ca': 'Shift Swap Requests',
  'Biên Bản Bàn Giao Ca': 'Shift Handover Logs',
  'Danh Sách Nhân Viên': 'Staff Member List',

  // Cashier Journal & Transactions
  'Báo Cáo Doanh Thu, Dòng Tiền Cơ Sở & Thu Ngân': 'Facility Revenue, Cashflow & Cashier Journal',
  'Báo cáo thu ngân': 'Cashier Journal',
  'Sổ Quỹ & Nhật Ký Giao Dịch': 'Cashier Journal & Transaction Log',
  'Tổng thu ngân thực nhận': 'Total Cash Collected',
  'paid transactions': 'paid transactions',
  'giao dịch đã thanh toán': 'paid transactions',
  'Thu tiền thuê kho & gia hạn': 'Rental & Renewal Collections',
  'Phí dịch vụ lưu trữ định kỳ': 'Recurring storage service fee',
  'Thu tiền cọc nhận kho (Ký quỹ)': 'Security Deposit Collections (Escrow)',
  'Cọc giữ kho & bảo chứng tài sản': 'Unit holding deposit & property security',
  'Tiền hoàn cọc đã chi trả': 'Completed refunds',
  'Tiền hoàn cọc đã chi trả; hiển thị tách biệt với thực thu': 'Completed refunds; shown separately from cash collected',
  'Completed refunds': 'Completed refunds',
  'Completed refunds; shown separately from cash collected': 'Completed refunds; shown separately from cash collected',
  'Tìm mã GD, mã kho (#A-101), khách hàng...': 'Search Txn ID, unit (#A-101), customer...',
  'Tất cả loại giao dịch': 'All transaction types',
  'Tất cả trạng thái': 'All statuses',
  'Mã GD / Giờ nhận': 'Txn ID / Time',
  'Loại thanh toán': 'Payment Type',
  'Phương thức': 'Method',
  'Số tiền': 'Amount',
  'Trạng thái': 'Status',
  'Tiền cọc': 'Deposit',
  'Tiền thuê': 'Rental Fee',
  'Gia hạn thuê': 'Renewal Fee',
  'Phụ phí': 'Extra Charge',
  'Thanh toán đơn đặt': 'Booking Payment',
  'Rental, renewal & extra charge': 'Rental, renewal & extra charge',
  'Tiền thuê, gia hạn & phụ phí': 'Rental, renewal & extra charge',
  'Paid / received': 'Paid / received',
  'Đã thanh toán / Đã thu': 'Paid / received',
  'Đang chờ xử lý': 'Pending',
  'Chờ thanh toán': 'Pending',
  'Đã thanh toán': 'Paid',
  'Chờ hoàn tiền': 'Refund Pending',
  'Đã hoàn tiền': 'Refunded',
  'Thất bại': 'Failed',
  'Hết hạn': 'Expired',
  'Từ ngày': 'From date',
  'Đến ngày': 'To date',
  'Nhật ký thanh toán trong kỳ. Trạng thái chờ, thất bại và hoàn tiền được hạch toán tách biệt với thực nhận.':
    'Selected-period payment ledger. Pending, failed, and refund statuses remain separate from cash received.',
  'Selected-period payment ledger. Pending, failed, and refund statuses remain separate from cash received.':
    'Selected-period payment ledger. Pending, failed, and refund statuses remain separate from cash received.',
  'Thanh toán đơn đặt:': 'Booking payments:',
  'Booking payments:': 'Booking payments:',

  // Incident Tickets
  'Quản Lý & Xử Lý Sự Cố Boxora': 'Boxora Incident Ticket Management',
  'Ghi Nhận Sự Cố': 'Report Incident',
  'Tổng sự cố trong phạm vi': 'Total Tickets in Scope',
  'Chưa hoàn tất': 'Unresolved Tickets',
  'Quá hạn SLA': 'SLA Overdue',
  'Đã xử lý & hoàn tất': 'Resolved & Closed',
  'Chờ tiếp nhận': 'Pending Acceptance',
  'Đang xử lý': 'In Progress',
  'Đã giải quyết': 'Resolved',
  'Đã đóng': 'Closed',
  'Mở lại (Xử lý lại)': 'Reopened',
  'Khẩn cấp': 'Critical',
  'Cao': 'High',
  'Trung bình': 'Medium',
  'Thấp': 'Low',
  'Khóa SmartLock': 'SmartLock Lock',
  'Truy cập kho': 'Unit Access',
  'Vệ sinh & Côn trùng': 'Cleanliness & Pest',
  'Nhiệt độ & Độ ẩm': 'Temperature & Humidity',
  'Hư hỏng thiết bị': 'Facility Damage',
  'Khác / Chung': 'Other / General',
  'Phân công nhân viên': 'Assign Staff',
  'Ghi nhật ký trao đổi': 'Add Contact Log',
  'Xác nhận đóng phiếu sự cố': 'Confirm Ticket Closure',
  'CHẾ ĐỘ GIÁM SÁT': 'MONITORING MODE',
  'Chế độ Xem & Báo Cáo Sự Cố:': 'Incident Oversight & Reporting Mode:',
  'Xử lý sự cố tại chỗ': 'On-site Incident Tickets',
  'Giám sát sự cố & SLA': 'Incident Oversight & SLA',

  // Overdue Management & Risk Control
  'Xử Lý Nợ Cước Quá Hạn & Thu Hồi PIN/QR': 'Overdue Delinquency & Access Revocation',
  'Xử lý nợ cước quá hạn': 'Overdue Delinquency',
  'Tổng nợ cước cần thu': 'Total Delinquent Balance',
  'Kho vi phạm quá hạn': 'Overdue Storage Units',
  'Đạt ngưỡng thu hồi PIN/QR': 'Threshold for Access Revocation',
  'Đủ điều kiện niêm phong': 'Eligible for Asset Sealing',
  'Ân hạn nhắc cước': 'Grace Period',
  'Cảnh báo': 'Warning Stage',
  'Thiếu chính sách': 'Policy Unconfigured',
  'Xuất CSV': 'Export CSV',
  'Thu hồi mã PIN/QR': 'Revoke PIN/QR Access',
  'Gửi thông báo nhắc cước': 'Send Payment Notice',
  'Lập biên bản niêm phong kho': 'Record Asset Sealing',
  'Cơ sở không có nợ cước quá hạn': 'No overdue delinquency at this facility',
  'Tất cả khách hàng tại': 'All customers at',
  'đang duy trì thanh toán đúng hạn.': 'maintain on-time payments.',
  'Quá hạn ': 'Overdue ',
  ' ngày': ' days',

  // Manager Floorplan & Layout
  'Sơ Đồ Cơ Sở Kho & Trạng Thái Buồng': 'Facility Layout & Unit Occupancy',
  'Bảng Tổng Quan Quản Lý': 'Manager Overview Dashboard',
  'Quản Lý Vận Hành Cơ Sở': 'Facility Operations Management',
  'Sơ đồ cơ sở kho': 'Facility storage layout',
  'Tổng quan quản lý cơ sở': 'Facility management overview',
  'Tổng số kho': 'Total Units',
  'Đang thuê': 'Rented',
  'Kho trống': 'Available',
  'Quá hạn': 'Overdue',
  'Chờ giao': 'Pending Move-in',
  'Thêm kho mới': 'Add New Storage Unit',
  'Sơ đồ mặt bằng Tầng 1': 'Level 1 Floorplan',
  'Sơ đồ mặt bằng Tầng 2': 'Level 2 Floorplan',
  'Tất cả kích cỡ': 'All Sizes',
  'Nhỏ (≤ 6.5m²)': 'Small (≤ 6.5m²)',
  'Vừa (6.5 - 12m²)': 'Medium (6.5 - 12m²)',
  'Lớn (> 12m²)': 'Large (> 12m²)',
  'Khu vực A': 'Zone A',
  'Khu vực B': 'Zone B',
  'Khu vực C': 'Zone C',
  'Lịch Sử Mở Cửa & Nhật Ký SmartLock': 'Door Access History & SmartLock Log',
  'Thông Tin Khách Thuê & Hợp Đồng': 'Tenant & Contract Details',
  'Chuyển trạng thái bảo trì': 'Toggle Maintenance',
  'Xem hồ sơ đối soát': 'View Verification Record',
  'Tiền Cọc Bảo Lãnh': 'Held Security Deposit',
  'Hạn Kết Thúc': 'Contract End Date',
  'Hết Hạn Sau': 'Expires In',
  'Ngoại lệ vi phạm': 'Policy Exception',
  'Chính sách cơ sở': 'Facility Policy',
  'Hiệu suất cơ sở': 'Facility Performance',

  // Admin & RBAC System
  'Chi nhánh & cơ sở lưu trữ': 'Branches & Storage Facilities',
  'Cấu hình chi nhánh & cơ sở': 'Branch & Facility Configuration',
  'Cấu hình chi nhánh': 'Branch configuration',
  'Phân quyền RBAC & quản lý người dùng': 'RBAC & User Management',
  'Hệ thống phân quyền & quản trị vai trò': 'Permission Matrix & Role Management',
  'Người dùng & phân quyền': 'Users, Roles & Permissions',
  'Người dùng, vai trò & phân quyền': 'Users, Roles and Permissions',
  'Users, roles and permissions': 'Users, roles and permissions',
  'Quản trị hệ thống': 'System Administration',
  'System administration': 'System administration',
  'Nhật ký kiểm toán hệ thống': 'System Audit Trail',
  'Giám sát nghiệp vụ': 'Operational Oversight',
  'Authorized oversight': 'Authorized oversight',
  'Báo cáo kinh doanh': 'Business Reports',
  'Business reports': 'Business reports',
  'Thêm người dùng mới': 'Add New User',
  'Ma trận phân quyền vai trò': 'Role-Based Access Matrix',
  'Lưu ma trận quyền': 'Save Permission Matrix',
  'Chi nhánh mở cửa vận hành': 'Operating facilities',
  'Đang sửa chữa hoặc tạm khóa': 'Under maintenance or locked',
  'Đã gắn tọa độ bản đồ': 'GPS map coordinates configured',
  'Chế độ chỉ xem cho Quản trị viên': 'Admin view-only mode',
  'Thẩm quyền thêm mới và cấu hình chi nhánh thuộc về Business Operations Manager.':
    'Branch creation & configuration belong to Business Operations Manager.',

  // Customer Portal & Bookings
  'Dịch Vụ Khách Thuê': 'Tenant Services',
  'Kho của tôi & Mã PIN': 'My Storage & PIN',
  'Tìm & Thuê kho mới': 'Find & Rent Storage',
  'Hợp đồng & Hóa đơn': 'Contracts & Invoices',
  'Trung tâm hỗ trợ': 'Help & Support Center',
  'Hợp Đồng Thuê Kho Của Bạn': 'Your Active Rental Contracts',
  'Mã PIN mở kho SmartLock': 'SmartLock Access PIN',
  'Đổi mã PIN mới': 'Change Access PIN',
  'Cấp mã phụ (Dùng 1 lần)': 'Issue Guest PIN (One-time)',
  'Lịch Sử Giao Dịch & Hóa Đơn VAT': 'Transaction History & VAT Invoices',
  'Yêu cầu xuất hóa đơn VAT': 'Request e-VAT Invoice',
  'Hủy đặt chỗ & Hoàn cọc': 'Cancel Booking & Refund',
  'Đổi lịch hẹn nhận kho': 'Reschedule Move-in Appointment',
  'Xem hợp đồng đã ký': 'View Signed Contract',
  'Ký điện tử ngay': 'Sign Contract Online',
  'Thanh toán ngay qua VNPay': 'Pay Online via VNPay',
  'Thanh toán đã xác nhận · Hợp đồng chưa xác minh': 'Payment Confirmed · Contract Pending Verification',
  'Đơn đặt thuê chưa hoàn tất': 'Rental Request Incomplete',
  'Thanh toán đã được backend xác nhận': 'Payment confirmed by backend',
  'Đặt thuê và thanh toán thành công!': 'Storage booking & payment successful!',
  'Đang đối soát thông tin với Boxora…': 'Reconciling details with Boxora…',
  'Đang xác minh giao dịch': 'Verifying transaction',
  'Thanh toán chưa thành công': 'Payment Unsuccessful',
  'Chưa xác nhận được thanh toán': 'Payment Not Yet Confirmed',
  'Thử thanh toán lại': 'Retry Payment',
  'Mở hợp đồng để ký': 'Open Contract to Sign',
  'Về trang tổng quan': 'Back to Dashboard',
  'Xem lịch nhận kho': 'View Move-in Schedule',
  'Hợp đồng và thanh toán': 'Contract & Payment',
  'Boxora · Đặt thuê trực tuyến': 'Boxora · Online Storage Booking',

  // Authentication & Account
  'Đăng nhập tài khoản Boxora': 'Sign In to Boxora Account',
  'Đăng ký tài khoản khách thuê': 'Register Tenant Account',
  'Ghi nhớ đăng nhập': 'Remember Sign In',
  'Quên mật khẩu?': 'Forgot Password?',
  'Chưa có tài khoản?': "Don't have an account?",
  'Đã có tài khoản?': 'Already have an account?',
  'Về trang đăng nhập': 'Back to Sign In',
  'Đặt Lại Mật Khẩu': 'Reset Password',
  'Đổi Mật Khẩu Thành Công': 'Password Reset Successful',
  'Thiếu mã token xác thực': 'Missing verification token',
  'Yêu cầu cấp lại liên kết mới': 'Request a new reset link',
  'Gửi email khôi phục mật khẩu': 'Send Password Reset Email',
  'Về trang chủ Boxora': 'Back to Boxora Home',
  'Phiên tài khoản': 'Account session',
  'Account session': 'Account session',
  'Phiên đăng nhập đang hoạt động': 'Signed-in session active',
  'Signed-in session active': 'Signed-in session active',
  'API và dữ liệu cơ sở sẵn sàng': 'Facility API and data available',
  'Facility API and data available': 'Facility API and data available',
  'Đang kiểm tra kết nối': 'Checking connection',
  'Checking connection': 'Checking connection',
  'Không kết nối được API': 'Facility API unavailable',
  'Facility API unavailable': 'Facility API unavailable',
  'Kiểm tra từ API cơ sở mỗi 60 giây': 'Checked through the facility API every 60 seconds',
  'Checked through the facility API every 60 seconds': 'Checked through the facility API every 60 seconds',
  'Cơ sở được phân công': 'Assigned Facility',
  'Assigned Facility': 'Assigned Facility',

  // --- NEW TRANSLATIONS ---
  'Cách hoạt động': 'How It Works',
  'Công nghệ': 'Technology',
  'Dịch vụ': 'Services',
  'Kích cỡ & Giá': 'Sizes & Pricing',
  'Chính sách': 'Policies',
  'Hỗ trợ': 'Support',
  'Đặt kho ngay': 'Rent a Storage Unit',
  'Cách thuê kho': 'How to Rent',
  'Không gian lưu trữ linh hoạt': 'Flexible Smart Self-Storage',
  'Chọn diện tích phù hợp': 'Choose the ideal storage size',
  'Nhận mã PIN sau khi hoàn tất bàn giao': 'Receive your smart PIN upon unit handover',
  'Cuộn xuống xem nội dung Boxora': 'Scroll down to explore Boxora',
  'Vào Portal Quản Lý Kho (Khóa IoT)': 'Enter Storage Management Portal (IoT Locks)',
  'Đơn Đặt Giữ Chỗ Của Tôi': 'My Storage Reservations',
  'Đơn Đặt Chỗ Của Tôi': 'My Storage Reservations',
  'Minh họa trừu tượng về mạng lưới kết nối Boxora': 'Abstract illustration of Boxora network',
  'Vào Trang Điều Hành Portal': 'Enter Management Portal',
  'Tài khoản & Bảo mật': 'Account & Security',
  'Hồ sơ cá nhân và mật khẩu': 'Profile & Security settings',
  'Cài đặt web & hệ thống': 'Web & System settings',
  'Chủ đề, phông chữ, ngôn ngữ': 'Theme, font & language',
  'Tùy chỉnh nhanh': 'Quick Preferences',
  'Giao diện tối': 'Dark Mode',
  'Chuyển sang giao diện sáng': 'Switch to light theme',
  'Chuyển sang giao diện tối': 'Switch to dark theme',
  'Ngôn ngữ': 'Language',
  'Đăng xuất': 'Sign Out',
  'Kết thúc phiên làm việc': 'End active session',
  '01 / HÀNH TRÌNH ĐẶT KHO KHÉP KÍN': '01 / SEAMLESS STORAGE RESERVATION',
  'HÀNH TRÌNH ĐẶT KHO KHÉP KÍN': 'SEAMLESS STORAGE RESERVATION',
  '6 bước đơn giản từ trực tuyến đến buồng kho thực tế.': '6 easy steps from online booking to your actual private storage unit.',
  '6 bước đơn giản từ trực tuyến đến buồng kho thực tế': '6 easy steps from online booking to your actual private storage unit',
  'BƯỚC 1': 'STEP 1',
  'BƯỚC 2': 'STEP 2',
  'BƯỚC 3': 'STEP 3',
  'BƯỚC 4': 'STEP 4',
  'BƯỚC 5': 'STEP 5',
  'BƯỚC 6': 'STEP 6',
  'Chọn Cơ Sở Kho': 'Select Storage Facility',
  'Khám phá danh sách các chi nhánh Boxora hiện đại và lựa chọn địa điểm lưu trữ thuận tiện nhất.': 'Explore modern Boxora facilities across HCMC and pick your most convenient location.',
  'Hệ thống 4 cơ sở TP.HCM': '4 modern facilities in HCMC',
  'Mạng lưới trung tâm': 'Central Network',
  'Quận 1 • Quận 7 • Thủ Đức • Tân Bình': 'District 1 • District 7 • Thu Duc • Tan Binh',
  'Hệ thống 4 cơ sở kho tự quản hiện đại tại TP. Hồ Chí Minh': '4 modern smart self-storage facilities in Ho Chi Minh City',
  'Chọn Kích Thước 3D': 'Interactive 3D Size Selection',
  'Trải nghiệm 16 quy chuẩn thể tích từ 1m³ đến 24m³, tùy chọn buồng tiêu chuẩn hoặc kho lạnh A/C.': 'Experience 16 volumetric sizes from 1m³ to 24m³, with standard or climate-controlled (A/C) options.',
  'Mô hình 3D trực quan': 'Visual 3D Simulation',
  'Quy chuẩn không gian': 'Volumetric Standard',
  '16 cỡ (1m³ – 24m³) • Non-A/C & A/C': '16 sizes (1m³ – 24m³) • Non-A/C & A/C',
  'Không gian bên trong buồng kho thực tế cao thoáng, sàn phủ epoxy': 'Spacious interior storage unit with dust-proof epoxy coated floors',
  'Thời Gian & Lịch Hẹn': 'Rental Term & Appointment',
  'Chọn kỳ hạn thuê (gói tháng hoặc theo ngày ≥ 7 ngày), lịch đón tiếp và tự động đồng bộ CCCD tài khoản.': 'Choose flexible term (monthly or daily ≥ 7 days), arrival schedule, and auto-sync identity profile.',
  'Đồng bộ từ tài khoản': 'Synced from account profile',
  'Ưu đãi kỳ hạn dài': 'Long-term discounts',
  'Giảm 5% – 20% • Thuê lẻ từ 7 ngày': 'Save 5% – 20% • Daily rental from 7 days',
  'Hành lang buồng kho an ninh 24/7 sẵn sàng đón khách theo lịch hẹn': '24/7 secure facility corridor ready to welcome you on schedule',
  'Xem Báo Giá & Chi Tiết': 'Transparent Quotation & Details',
  'Xem bảng kê chi phí chính thức, tiền cọc bảo đảm kho, phí 0đ và rà soát kỹ lưỡng chi tiết đơn đặt.': 'Review transparent cost breakdown, refundable deposit, zero hidden fees, and booking specs.',
  'Báo giá minh bạch 0đ phí': 'Transparent 0₫ Hidden Fee Quote',
  'Cam kết tài chính': 'Financial Commitment',
  'Tiền cọc bảo đảm kho • Hoàn trả khi ngừng thuê': 'Security deposit • 100% refunded when lease ends',
  'Sức chứa thực tế minh bạch, chỉ trả phí theo đúng cỡ kho lựa chọn': 'Transparent storage volume, only pay for the exact size you reserve',
  'Thanh Toán Linh Hoạt': 'Flexible Payment Options',
  'Thanh toán trực tuyến qua cổng VNPay / VietQR để ký hợp đồng điện tử ngay, hoặc chọn giữ chỗ trước 0đ thanh toán khi nhận kho.': 'Pay online via VNPay / VietQR to sign digital contract instantly, or choose 0₫ reservation and pay on-site.',
  'VNPay / VietQR hoặc Giữ chỗ 0đ': 'VNPay / VietQR or 0₫ Reservation',
  'Phương thức giao dịch': 'Payment Methods',
  'Ký HĐ điện tử ngay hoặc Giữ chỗ 0₫': 'Instant digital contract or 0₫ reservation',
  'Buồng kho riêng biệt tích hợp khóa thông minh sẵn sàng kích hoạt': 'Private smart storage unit with integrated IoT lock ready for activation',
  'Đặt Chỗ & Chờ Tiếp Đón': 'Reservation & Handover',
  'Nhận mã giữ chỗ tức thì. Chuyên viên Boxora chủ động liên hệ hỗ trợ thủ tục nhận bàn giao buồng kho.': 'Receive instant booking code. Boxora staff will proactively contact you to assist with unit handover.',
  'Nhân viên hỗ trợ tận tình': 'Dedicated support staff',
  'Quyền truy cập tự quản': 'Self-storage access',
  'Cấp mã PIN khóa số IoT ra vào 24/7': 'Instant IoT PIN for 24/7 self-access',
  'Nhận bàn giao buồng kho, ký hợp đồng nghiệm thu và sử dụng ngay': 'Accept unit handover, sign inspection document, and start storing immediately',
  '02 / CÔNG NGHỆ BẢO MẬT IOT ĐỘC QUYỀN': '02 / PROPRIETARY IOT SECURITY TECHNOLOGY',
  'CÔNG NGHỆ BẢO MẬT IOT ĐỘC QUYỀN': 'PROPRIETARY IOT SECURITY TECHNOLOGY',
  'Kiểm soát ra vào thông minh, an toàn tuyệt đối mọi lúc mọi nơi.': 'Smart access control, absolute security anytime, anywhere.',
  'Kiểm soát ra vào thông minh, an toàn tuyệt đối mọi lúc mọi nơi': 'Smart access control, absolute security anytime, anywhere',
  'Khóa Số Thông Minh 24/7': '24/7 Smart Digital Lock',
  'KHÓA SỐ THÔNG MINH 24/7': '24/7 SMART DIGITAL LOCK',
  'Truy cập buồng kho qua mã PIN định danh hoặc mở từ xa trên điện thoại không cần chìa vật lý.': 'Access your private unit via authenticated PIN or unlock remotely via mobile app with zero physical keys.',
  'Chốt Khóa Tự Động': 'Automatic Auto-Deadbolt',
  'CHỐT KHÓA TỰ ĐỘNG': 'AUTOMATIC AUTO-DEADBOLT',
  'Hệ thống cảm biến tự đóng chốt khi khép cửa, thông báo tức thì nếu cửa chưa đóng kín.': 'Integrated sensors automatically lock upon door closure, alerting immediately if left ajar.',
  'Ủy Quyền Truy Cập Linh Hoạt': 'Flexible Access Delegation',
  'ỦY QUYỀN TRUY CẬP LINH HOẠT': 'FLEXIBLE ACCESS DELEGATION',
  'Tạo mã truy cập tạm thời cho người thân, đối tác hoặc nhân viên giao vận nhận hàng.': 'Generate temporary access PINs for relatives, business partners, or delivery couriers.',
  'Vi Khí Hậu & Nhật Ký Truy Cập': 'Microclimate & Audit Trail',
  'VI KHÍ HẬU & NHẬT KÝ TRUY CẬP': 'MICROCLIMATE & AUDIT TRAIL',
  'Giám sát nhiệt độ, độ ẩm và lưu trữ lịch sử mở khóa chi tiết theo thời gian thực.': 'Monitor real-time temperature, humidity, and maintain timestamped unlock logs.',
  'Hệ thống khóa thông minh IoT Boxora': 'Boxora Smart IoT Lock System',
  '03 / KHÔNG GIAN LƯU TRỮ CHUYÊN BIỆT': '03 / DEDICATED STORAGE SPACES',
  'KHÔNG GIAN LƯU TRỮ CHUYÊN BIỆT': 'DEDICATED STORAGE SPACES',
  'Thiết kế chuẩn mực cho': 'Engineered to perfection for',
  'cá nhân & doanh nghiệp.': 'individuals & enterprises.',
  'cá nhân & doanh nghiệp': 'individuals & enterprises',
  'HỆ THỐNG 4 CƠ SỞ CHO THUÊ KHO TẠI TP. HỒ CHÍ MINH': 'NETWORK OF 4 STORAGE FACILITIES IN HO CHI MINH CITY',
  'ĐƠN GIÁ THUÊ TIÊU CHUẨN (NON-A/C)': 'STANDARD RENTAL RATES (NON-A/C)',
  'Buồng Kho Tiêu Chuẩn (Non-A/C)': 'Standard Unit (Non-A/C)',
  'Buồng Kho Máy Lạnh A/C (18–22°C)': 'Climate-Controlled A/C Unit (18–22°C)',
  'Cỡ Kho Mini & Nhỏ (1m³ – 4m³)': 'Mini & Small Units (1m³ – 4m³)',
  'Cỡ Kho Tiêu Chuẩn (5m³ – 9m³)': 'Standard Units (5m³ – 9m³)',
  'Cỡ Kho Lớn (10m³ – 24m³)': 'Large Commercial Units (10m³ – 24m³)',
  '01 / QUẬN 1': '01 / DISTRICT 1',
  '02 / QUẬN 7': '02 / DISTRICT 7',
  '03 / THỦ ĐỨC': '03 / THU DUC',
  '04 / TÂN BÌNH': '04 / TAN BINH',
  'Cơ Sở 1 • Boxora Quận 1:': 'Facility 1 • Boxora District 1:',
  'Cơ Sở 2 • Boxora Quận 7 (Nam Sài Gòn):': 'Facility 2 • Boxora District 7 (South Saigon):',
  'Cơ Sở 3 • Boxora Thủ Đức Hub:': 'Facility 3 • Boxora Thu Duc Hub:',
  'Cơ Sở 4 • Boxora Tân Bình Mega Hub:': 'Facility 4 • Boxora Tan Binh Mega Hub:',
  'Vị trí trung tâm tài chính, trần cao 3.0m, mở cửa 24/7.': 'Financial center location, 3.0m high ceiling, 24/7 access.',
  'Khu đô thị hiện đại, xe tải đỗ tận cửa, camera an ninh AI.': 'Modern urban area, direct truck dock access, AI security cameras.',
  'Diện tích kho rộng, hỗ trợ xe nâng, thang tải hàng 2 tấn.': 'Spacious floor plates, forklift support, 2-ton cargo lifts.',
  'Gần sân bay Tân Sơn Nhất, sàn sơn epoxy chống bụi, kiểm soát ẩm.': 'Near Tan Son Nhat Airport, dust-free epoxy flooring, humidity control.',
  '04 / QUY CHUẨN THỂ TÍCH & KÍCH THƯỚC': '04 / VOLUMETRIC & SIZE STANDARDS',
  'QUY CHUẨN THỂ TÍCH & KÍCH THƯỚC': 'VOLUMETRIC & SIZE STANDARDS',
  'Từ tủ locker 1m³ cá nhân': 'From 1m³ personal mini-lockers',
  'đến buồng kho doanh nghiệp 24m³.': 'to 24m³ enterprise commercial units.',
  'đến buồng kho doanh nghiệp 24m³': 'to 24m³ enterprise commercial units',
  'Tiêu chuẩn lưu trữ cá nhân & gia đình': 'Personal & Household Storage Standard',
  'Buồng kho doanh nghiệp & hàng hóa lớn': 'Enterprise & Bulk Commercial Storage',
  'Trần cao': 'Ceiling height',
  'TRẦN CAO 2.7M – 3.0M': 'CEILING HEIGHT 2.7M – 3.0M',
  'Kết cấu cửa & Khóa:': 'Door & Lock Specs:',
  'Phù hợp nhất cho:': 'Best suited for:',
  'Thang đo 16 quy chuẩn thể tích thực tế (1 m³ → 24 m³)': '16 actual volumetric standards gauge (1 m³ → 24 m³)',
  'Nhóm đang chọn:': 'Selected Tier:',
  'Tủ mini locker 1m³ cá nhân': 'Personal mini locker 1m³',
  'Buồng kho cá nhân 1.5m – 2.0m': 'Personal unit 1.5m – 2.0m',
  'Kho gia đình & đồ đạc 2.4m': 'Family & furniture storage 2.4m',
  'Kho thương mại & pallet 2.7m – 3.0m': 'Commercial & pallet storage 2.7m – 3.0m',
  '05 / CHÍNH SÁCH & HỎI ĐÁP': '05 / POLICIES & FAQ',
  'CHÍNH SÁCH MINH BẠCH & AN TÂM TUYỆT ĐỐI': 'TRANSPARENT POLICIES & COMPLETE PEACE OF MIND',
  'Rõ ràng về tiền cọc, bảo mật thông tin và quyền lợi khách hàng.': 'Clear deposit terms, data confidentiality, and complete customer protection.',
  'Rõ ràng về tiền cọc, bảo mật thông tin và quyền lợi khách hàng': 'Clear deposit terms, data confidentiality, and complete customer protection',
  '01 / Hoàn Cọc & Chi Phí': '01 / Deposit Refund & Costs',
  '02 / Bảo Hiểm Tài Sản': '02 / Asset Insurance',
  '03 / Kỳ Hạn & Đổi Cỡ': '03 / Terms & Resizing',
  '04 / An Toàn PCCC': '04 / Fire Safety Standards',
  'Tất Cả': 'All FAQs',
  'Cơ Sở & Chế Độ Kho': 'Facilities & Storage Modes',
  'Tiền cọc dùng để bảo đảm cho kho và hoàn trả lại khi ngừng thuê': 'Security deposit protects storage units and is 100% refunded when lease ends',
  'Chính Sách Tiền Cọc Bảo Đảm Kho & Hoàn Trả Khi Kết Thúc Thuê': 'Security Deposit Policy & Full Refund Upon Lease Termination',
  'Chính Sách Tiền Cọc & Hoàn Trả': 'Security Deposit & Refund Policy',
  'ÁP DỤNG CHO KHÁCH HÀNG CÁ NHÂN & DOANH NGHIỆP': 'APPLIED TO INDIVIDUAL & ENTERPRISE CUSTOMERS',
  'MỤC ĐÍCH TIỀN CỌC': 'DEPOSIT PURPOSE',
  'Bảo Đảm Buồng Kho Trong Thời Gian Thuê': 'Securing the Storage Unit During Lease Period',
  'HOÀN TRẢ KHI NGỪNG THUÊ': 'REFUND UPON LEASE TERMINATION',
  'Trả Lại Đầy Đủ Khi Không Thuê Kho Nữa': '100% Refund When You Stop Renting',
  'KHÔNG CHI PHÍ ẨN': 'NO HIDDEN FEES',
  'Thanh Toán VNPay Hoặc Giữ Chỗ 0₫': 'Online Payment via VNPay or 0₫ Reservation',
  'Bảo vệ an toàn giá trị tài sản lưu kho toàn diện': 'Comprehensive protection for your stored assets',
  'BẢO TRỢ BỞI ĐƠN VỊ BẢO HIỂM TÀI SẢN UY TÍN': 'UNDERWRITTEN BY REPUTABLE PROPERTY INSURERS',
  'Bảo Hiểm Tài Sản 50–500 Triệu': '50M–500M VND Asset Insurance',
  'GÓI TIÊU CHUẨN • MIỄN PHÍ': 'STANDARD PLAN • COMPLIMENTARY',
  'GÓI MỞ RỘNG • DOANH NGHIỆP': 'EXTENDED ENTERPRISE PLAN',
  'Dành cho doanh nghiệp hoặc cá nhân cất giữ hàng hóa giá trị cao, thiết bị quang học, máy móc chính xác với mức phí phụ trợ ưu đãi.': 'Designed for businesses or individuals storing high-value cargo, optical devices, or precision equipment at preferential rates.',
  'Giải Quyết Minh Bạch 7 – 14 Ngày': 'Transparent Claim Settlement in 7 – 14 Days',
  'Ưu đãi chiết khấu hợp đồng dài hạn & Thuê từ 07 ngày': 'Long-term contract discounts & Daily rental from 7 days',
  'Thời Hạn Thuê Linh Hoạt, Tự Động Gia Hạn & Đổi Cỡ Kho Miễn Phí': 'Flexible Lease Terms, Auto-Renewal & Free Size Changes',
  'Gia Hạn & Đổi Cỡ Kho Miễn Phí': 'Free Lease Renewal & Size Change',
  'ĐIỀU KHOẢN HỢP ĐỒNG MINH BẠCH & CHỦ ĐỘNG': 'TRANSPARENT & PROACTIVE CONTRACT TERMS',
  'THỜI HẠN LINH HOẠT': 'FLEXIBLE RENTAL TERM',
  'Thuê Từ 07 Ngày Hoặc Theo Tháng': 'Daily from 7 Days or Monthly',
  'Hỗ trợ thuê ngắn hạn theo ngày (tối thiểu ≥ 07 ngày) hoặc thuê theo tháng (1, 3, 6, 12, 24 tháng) với mức chiết khấu tự động từ 5% đến 20%.': 'Supports short-term daily rentals (min ≥ 7 days) or monthly plans (1, 3, 6, 12, 24 months) with automatic 5% to 20% discounts.',
  'GIA HẠN & ĐỔI CỠ KHO': 'RENEWAL & SIZE CHANGE',
  'Thông Báo Trước 5 Ngày • Đổi Cỡ 0₫': '5 Days Notice • 0₫ Size Change Fee',
  'Báo Trước 07 Ngày Không Phí Phạt': '7 Days Notice with Zero Penalty',
  '100% buồng kho trang bị cảm biến khói nhiệt tự động': '100% of storage units equipped with automated thermal smoke detectors',
  'TIÊU CHUẨN AN TOÀN PHÒNG CHÁY CHỮA CHÁY QUỐC GIA': 'NATIONAL FIRE SAFETY & PREVENTION STANDARDS',
  'Danh Mục Hàng Cấm & PCCC': 'Prohibited Goods & Fire Safety Standards',
  'Tuyệt Đối Nghiêm Cấm Lưu Trữ': 'Strictly Prohibited Goods',
  'Cấm lưu trữ xăng dầu, bình gas, pháo hoa, pin lithium hỏng/phồng, dung môi sơn, hóa chất ăn mòn và các vật liệu nguy hại dễ bắt lửa.': 'Strictly prohibited: gasoline, gas canisters, fireworks, damaged/swollen lithium batteries, paint solvents, corrosive chemicals, and combustible hazards.',
  'HÀNG HÓA BẤT HỢP PHÁP & TƯƠI SỐNG': 'ILLEGAL & PERISHABLE COMMODITIES',
  'Tuân Thủ Quy Định Pháp Luật': 'Full Legal Compliance',
  'Cấm động vật sống, thực phẩm tươi sống dễ phân hủy gây mùi hôi, vũ khí, hàng lậu hoặc bất kỳ tài sản nào vi phạm pháp luật Việt Nam.': 'Prohibited: live animals, perishable foods, weapons, contraband, or any assets violating Vietnamese law.',
  'Cảm Biến Khói Nhiệt & Phun Sương Tự Động': 'Automated Thermal Smoke Detectors & Fire Sprinklers',
  '100% buồng kho trang bị đầu dò khói nhiệt thông minh kết nối trung tâm PCCC. Hệ thống chữa cháy tự động luôn trực chiến 24/7/365.': '100% of units feature smart thermal detectors connected to fire command. Automated suppression systems on active standby 24/7/365.',
  'Thời hạn thuê kho tối thiểu tại Boxora là bao lâu? Có ưu đãi dài hạn không?': 'What is the minimum rental period at Boxora? Are there long-term discounts?',
  'Tôi có thể thanh toán trực tuyến VNPay hay giữ chỗ trước rồi thanh toán sau?': 'Can I pay online via VNPay or make a 0₫ reservation and pay later?',
  'Sự khác biệt giữa Buồng Kho Tiêu Chuẩn (Non-A/C) và Kho Máy Lạnh (A/C) là gì?': 'What is the difference between Standard Units (Non-A/C) and Climate-Controlled (A/C) Units?',
  'Bảo vệ quyền lợi tuyệt đối.': 'Absolute protection of your rights.',
  'TỔNG ĐÀI 24/7': '24/7 HOTLINE',
  '1900 269 672 • Trực kỹ thuật': '1900 269 672 • Technical Duty',
  'EMAIL HỖ TRỢ': 'SUPPORT EMAIL',
  'Hợp đồng B2B & Hóa đơn VAT': 'B2B Contracts & VAT Invoices',
  'Gửi ảnh kho thực tế tức thì': 'Instant real unit photo dispatch',
  'Mỗi ngày (Kể cả Lễ/Tết)': 'Every day (including Holidays/Tet)',
  'BẮT ĐẦU LƯU TRỮ THÔNG MINH 24/7': 'START SMART STORAGE 24/7',
  'TRẠNG THÁI: CHỜ XÁC NHẬN': 'STATUS: PENDING CONFIRMATION',
  'KÍCH THƯỚC:': 'DIMENSIONS:',
  'DIỆN TÍCH MẶT SÀN:': 'FLOOR AREA:',
  'BỘ QUY CHUẨN VẬN HÀNH NGHIỆP VỤ KHO BOXORA 2026': 'BOXORA OPERATIONAL STANDARDS 2026',
  '100% TIÊU CHUẨN THÔNG MINH': '100% SMART STANDARDS',
  'HỆ THỐNG QUẢN LÝ VÀ VẬN HÀNH BOXORA': 'BOXORA SMART MANAGEMENT & OPERATIONS',
  '5 BƯỚC NHANH CHÓNG': '5 EASY STEPS',
  'MÃ ĐƠN GIỮ CHỖ CỦA BẠN': 'YOUR RESERVATION CODE',
  'ĐÃ GỬI TỚI STAFF TRỰC CA': 'DISPATCHED TO DUTY STAFF',
  'CƠ SỞ KHO:': 'FACILITY:',
  'ĐỊA CHỈ:': 'ADDRESS:',
  'THỜI GIAN HẸN:': 'APPOINTMENT TIME:',
  'THỂ TÍCH ĐỒ': 'CARGO VOLUME',
  'KÍCH THƯỚC': 'DIMENSIONS',
  'ĐỘ LẤP ĐẦY:': 'FILL RATE:',
  'Bảo đảm buồng kho': 'Storage unit security guarantee',
  'hoàn trả 100% khi ngừng thuê': '100% refunded upon lease termination',
  'Khi thanh lý hợp đồng và nghiệm thu buồng kho nguyên vẹn, Boxora cam kết hoàn trả 100% tiền cọc vào tài khoản ngân hàng trong vòng 24 giờ làm việc.': 'Upon contract liquidation and inspection of an intact storage unit, Boxora commits to refunding 100% of the deposit to your bank account within 24 working hours.',
  'Khi thanh lý hợp đồng và nghiệm thu buồng kho nguyên vẹn, Boxora cam kết hoàn trả 100% tiền cọc bảo đảm vào tài khoản ngân hàng trong vòng 24 giờ làm việc.': 'Upon contract liquidation and inspection of an intact storage unit, Boxora commits to refunding 100% of the security deposit to your bank account within 24 working hours.',
  'Thanh toán cọc hoặc kỳ hạn đầu để kích hoạt giữ buồng kho. Nhận mã PIN và hợp đồng điện tử ngay.': 'Pay deposit or first period to activate storage unit. Receive your smart PIN and e-contract immediately.',
})

// Pre-sorted dictionary keys by length descending to match longest phrases first
const SORTED_KEYS = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length)

// Build reverse dictionary for bidirectional English -> Vietnamese translation
export const REVERSE_DICTIONARY: Record<string, string> = {}
for (const [vi, en] of Object.entries(DICTIONARY)) {
  if (en && typeof en === 'string' && en !== vi && !REVERSE_DICTIONARY[en]) {
    REVERSE_DICTIONARY[en] = vi
  }
}
const SORTED_REVERSE_KEYS = Object.keys(REVERSE_DICTIONARY).sort((a, b) => b.length - a.length)

// WeakMaps storing original Vietnamese text and attributes
const originalTextMap = new WeakMap<Node, string>()
const originalAttrMap = new WeakMap<Element, Record<string, string>>()
const translatedTextMap = new WeakMap<Node, string>()
const translatedAttrMap = new WeakMap<Element, Record<string, string>>()

// Mutual exclusion flag to prevent observer recursion
let isTranslatingDOM = false

const translateText = (value: string) => {
  let translated = value
  for (const phrase of SORTED_KEYS) {
    if (translated.includes(phrase)) {
      translated = translated.split(phrase).join(DICTIONARY[phrase])
    }
  }
  return translated
}

const translateTextToVietnamese = (value: string) => {
  const trimmed = value.trim()
  if (REVERSE_DICTIONARY[trimmed]) {
    return value.replace(trimmed, REVERSE_DICTIONARY[trimmed])
  }
  let translated = value
  for (const phrase of SORTED_REVERSE_KEYS) {
    if (phrase.length > 2 && translated.includes(phrase)) {
      translated = translated.split(phrase).join(REVERSE_DICTIONARY[phrase])
    }
  }
  return translated
}

const applyTextNodeTranslation = (node: Node, lang: Language) => {
  const currentValue = node.nodeValue || ''
  if (!currentValue.trim()) return

  const original = originalTextMap.get(node)
  const lastTranslation = translatedTextMap.get(node)

  if (lang === 'en') {
    const source = lastTranslation !== undefined && currentValue === lastTranslation
      ? original ?? currentValue
      : currentValue
    originalTextMap.set(node, source)
    const translated = translateText(source)
    translatedTextMap.set(node, translated)
    if (translated !== currentValue) node.nodeValue = translated
    return
  }

  // lang === 'vi'
  if (lastTranslation !== undefined && currentValue === lastTranslation && original !== undefined) {
    if (currentValue !== original) node.nodeValue = original
  } else {
    // If currentValue contains an English string from REVERSE_DICTIONARY, translate it to Vietnamese
    const translated = translateTextToVietnamese(currentValue)
    if (translated !== currentValue) {
      node.nodeValue = translated
      originalTextMap.set(node, translated)
    } else {
      originalTextMap.set(node, currentValue)
    }
  }
  translatedTextMap.delete(node)
}

// Walk DOM and translate text nodes and attributes
function applyDOMTranslation(root: Node, lang: Language) {
  if (typeof document === 'undefined') return
  if (isTranslatingDOM) return

  isTranslatingDOM = true
  try {
    if (root.nodeType === Node.TEXT_NODE) {
      applyTextNodeTranslation(root, lang)
      return
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement
          if (!parent) return NodeFilter.FILTER_REJECT
          const tag = parent.tagName.toLowerCase()
          if (tag === 'script' || tag === 'style' || tag === 'code' || tag === 'noscript') {
            return NodeFilter.FILTER_REJECT
          }
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        },
      }
    )

    let currentNode = walker.nextNode()
    while (currentNode) {
      applyTextNodeTranslation(currentNode, lang)
      currentNode = walker.nextNode()
    }

    // Also translate attributes on elements: placeholder, title, aria-label, alt
    if (root instanceof Element || root instanceof Document) {
      const selector = '[placeholder], [title], [aria-label], [alt]'
      const elementsWithAttrs: Element[] = []
      if (root instanceof Element && root.matches(selector)) elementsWithAttrs.push(root)
      elementsWithAttrs.push(...Array.from(root.querySelectorAll(selector)))

      elementsWithAttrs.forEach((el) => {
        if (!originalAttrMap.has(el)) {
          originalAttrMap.set(el, {
            placeholder: el.getAttribute('placeholder') || '',
            title: el.getAttribute('title') || '',
            'aria-label': el.getAttribute('aria-label') || '',
            alt: el.getAttribute('alt') || '',
          })
        }
        const orig = originalAttrMap.get(el)!
        const lastTranslations = translatedAttrMap.get(el) || {}

        const attrNames = ['placeholder', 'title', 'aria-label', 'alt'] as const
        attrNames.forEach((attr) => {
          const currentValue = el.getAttribute(attr)
          if (currentValue === null) return

          if (lang === 'en') {
            const lastTranslation = lastTranslations[attr]
            const source = lastTranslation !== undefined && currentValue === lastTranslation
              ? orig[attr] ?? currentValue
              : currentValue
            orig[attr] = source
            const translated = translateText(source)
            lastTranslations[attr] = translated
            if (translated !== currentValue) el.setAttribute(attr, translated)
          } else {
            const lastTranslation = lastTranslations[attr]
            if (lastTranslation !== undefined && currentValue === lastTranslation) {
              const source = orig[attr]
              if (source !== undefined && source !== currentValue) el.setAttribute(attr, source)
            } else {
              const translated = translateTextToVietnamese(currentValue)
              if (translated !== currentValue) {
                el.setAttribute(attr, translated)
                orig[attr] = translated
              } else {
                orig[attr] = currentValue
              }
            }
            delete lastTranslations[attr]
          }
        })
        translatedAttrMap.set(el, lastTranslations)
      })
    }
  } finally {
    isTranslatingDOM = false
  }
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'vi',
  setLanguage: () => {},
  t: (key: string) => key,
})

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return getWebSettings().language || 'vi'
  })
  const [, startTransition] = useTransition()

  // Apply DOM-wide translation when language changes
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Apply translation to current document body
    applyDOMTranslation(document.body, language)

    // Setup MutationObserver to translate any dynamically inserted nodes
    const observer = new MutationObserver((mutations) => {
      if (isTranslatingDOM) return
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
              applyDOMTranslation(node, language)
            }
          })
        } else if (mutation.type === 'characterData') {
          applyDOMTranslation(mutation.target, language)
        } else if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          applyDOMTranslation(mutation.target, language)
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'],
    })

    return () => {
      observer.disconnect()
    }
  }, [language])

  // Listen for storage / cross-tab settings events
  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail?.language && e.detail.language !== language) {
        startTransition(() => {
          setLanguageState(e.detail.language)
        })
      }
    }
    window.addEventListener('boxora_settings_changed', handleSettingsChange)
    return () => {
      window.removeEventListener('boxora_settings_changed', handleSettingsChange)
    }
  }, [language])

  const setLanguage = (newLang: Language) => {
    startTransition(() => {
      setLanguageState(newLang)
    })
    saveWebSettings({ language: newLang })
  }

  const t = (key: string, fallback?: string): string => {
    if (!key) return ''
    const trimmed = key.trim()
    if (language === 'en') {
      if (DICTIONARY[trimmed]) return DICTIONARY[trimmed]
      if (REVERSE_DICTIONARY[trimmed]) return trimmed
      if (fallback) {
        if (DICTIONARY[fallback.trim()]) return DICTIONARY[fallback.trim()]
        return fallback
      }
      // Partial replace for dynamic strings
      let res = key
      for (const phrase of SORTED_KEYS) {
        if (res.includes(phrase)) {
          res = res.split(phrase).join(DICTIONARY[phrase])
        }
      }
      return res
    }

    // language === 'vi'
    if (REVERSE_DICTIONARY[trimmed]) return REVERSE_DICTIONARY[trimmed]
    if (fallback && DICTIONARY[fallback.trim()]) return fallback
    // If key has English phrases, translate them
    let res = key
    for (const phrase of SORTED_REVERSE_KEYS) {
      if (phrase.length > 2 && res.includes(phrase)) {
        res = res.split(phrase).join(REVERSE_DICTIONARY[phrase])
      }
    }
    return res
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
export default LanguageContext
