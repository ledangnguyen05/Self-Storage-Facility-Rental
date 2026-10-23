const fs = require('fs');

const files = [
  'FE/boxora-web/src/components/auth/ProtectedRoute.tsx',
  'FE/boxora-web/src/components/layout/DashboardLayout.tsx',
  'FE/boxora-web/src/components/layout/Navbar.tsx',
  'FE/boxora-web/src/components/layout/NotificationCenter.tsx',
  'FE/boxora-web/src/components/modals/BookingCheckoutModal.tsx',
  'FE/boxora-web/src/components/modals/ContractDocumentModal.tsx',
  'FE/boxora-web/src/components/modals/DocuSealSimulationModal.tsx',
  'FE/boxora-web/src/context/AuthContext.tsx',
  'FE/boxora-web/src/pages/customer/CustomerDashboard.tsx',
  'FE/boxora-web/src/pages/manager/ManagerDashboard.tsx',
  'FE/boxora-web/src/pages/public/HomePage.tsx',
  'FE/boxora-web/src/pages/public/PaymentResultPage.tsx',
  'FE/boxora-web/src/pages/public/RegisterPage.tsx',
  'FE/boxora-web/src/pages/public/UnitsExplorerPage.tsx',
  'FE/boxora-web/src/pages/staff/StaffDashboard.tsx',
  'FE/boxora-web/src/pages/staff/components/HandoverCheckInWorkbench.tsx',
  'FE/boxora-web/src/services/handoverService.ts',
  'FE/boxora-web/src/types/index.ts',
  'FE/boxora-web/src/utils/rentalAccess.ts'
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  let openMarkers = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('<<<<<<<')) {
      openMarkers++;
      if (openMarkers > 1) {
        console.log(`NESTED OPEN in ${file} at L${i+1}: ${lines[i]}`);
      }
    } else if (lines[i].startsWith('>>>>>>>')) {
      openMarkers--;
    }
  }
}

