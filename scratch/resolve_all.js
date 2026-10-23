const fs = require('fs');

const standardFiles = [
  'FE/boxora-web/src/components/auth/ProtectedRoute.tsx',
  'FE/boxora-web/src/components/layout/Navbar.tsx',
  'FE/boxora-web/src/components/layout/NotificationCenter.tsx',
  'FE/boxora-web/src/components/modals/BookingCheckoutModal.tsx',
  'FE/boxora-web/src/components/modals/ContractDocumentModal.tsx',
  'FE/boxora-web/src/context/AuthContext.tsx',
  'FE/boxora-web/src/pages/customer/CustomerDashboard.tsx',
  'FE/boxora-web/src/pages/public/HomePage.tsx',
  'FE/boxora-web/src/pages/public/PaymentResultPage.tsx',
  'FE/boxora-web/src/pages/public/RegisterPage.tsx',
  'FE/boxora-web/src/pages/public/UnitsExplorerPage.tsx',
  'FE/boxora-web/src/services/handoverService.ts',
  'FE/boxora-web/src/utils/rentalAccess.ts'
];

for (const file of standardFiles) {
  let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes('<<<<<<<')) {
    const updated = content.replace(/<{7} Updated upstream\n([\s\S]*?)={7}\n([\s\S]*?)>{7} Stashed changes/g, '$2');
    fs.writeFileSync(file, updated, 'utf8');
    console.log('Resolved standard file:', file);
  }
}

