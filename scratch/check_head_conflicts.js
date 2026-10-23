const fs = require('fs');
const files = [
  'FE/boxora-web/src/components/layout/DashboardLayout.tsx',
  'FE/boxora-web/src/components/modals/DocuSealSimulationModal.tsx',
  'FE/boxora-web/src/pages/manager/ManagerDashboard.tsx',
  'FE/boxora-web/src/pages/staff/StaffDashboard.tsx',
  'FE/boxora-web/src/pages/staff/components/HandoverCheckInWorkbench.tsx',
  'FE/boxora-web/src/types/index.ts'
];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  console.log('FILE: ' + file);
  const regex = /<{7}[^\n]*\n([\s\S]*?)={7}\n([\s\S]*?)>{7}[^\n]*/g;
  let match;
  let count = 0;
  while ((match = regex.exec(content)) !== null) {
    count++;
    console.log(`--- CONFLICT #${count} ---`);
    console.log('PART 1:\n' + match[1]);
    console.log('PART 2:\n' + match[2]);
  }
}

