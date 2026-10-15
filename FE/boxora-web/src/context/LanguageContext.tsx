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
  'Cập nhật họ tên, số điện thoại': 'Update full name, phone number',
  'Cập nhật thông tin cá nhân': 'Update personal details',
  'Cài đặt web & hệ thống': 'Web & System Settings',
  'Cài Đặt Trang Web & Vận Hành': 'Website Settings & Ops',
  'Cài đặt giao diện & hệ thống': 'Appearance & System Settings',
  'Tùy chỉnh trải nghiệm làm việc theo nhu cầu cá nhân': 'Personalize your interface and workspace experience',
  'Chủ đề, âm thanh, cảnh báo IoT': 'Theme, alert sounds, IoT alerts',
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

// Pre-sorted dictionary keys by length descending to match longest phrases first
const SORTED_KEYS = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length)

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

  if (lastTranslation !== undefined && currentValue === lastTranslation && original !== undefined) {
    if (currentValue !== original) node.nodeValue = original
  } else {
    // React has rendered fresh Vietnamese content into this text node.
    originalTextMap.set(node, currentValue)
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
              // React has rendered a fresh value; retain it as the Vietnamese source.
              orig[attr] = currentValue
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
      if (fallback) return fallback
      // Partial replace for dynamic strings
      let res = key
      for (const phrase of SORTED_KEYS) {
        if (res.includes(phrase)) {
          res = res.split(phrase).join(DICTIONARY[phrase])
        }
      }
      return res
    }
    return key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
export default LanguageContext
