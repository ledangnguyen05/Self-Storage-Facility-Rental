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
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('<<<<<<<')) {
    console.log(`=== File: ${file} ===`);
    const lines = content.split('\n');
    let inConflict = false;
    let conflictLines = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('<<<<<<<')) {
        inConflict = true;
        conflictLines.push(`L${i+1}: ${lines[i]}`);
      } else if (inConflict) {
        conflictLines.push(`L${i+1}: ${lines[i]}`);
        if (lines[i].startsWith('>>>>>>>')) {
          inConflict = false;
          console.log(conflictLines.join('\n'));
          console.log('---');
          conflictLines = [];
        }
      }
    }
  }
}

