const fs = require('fs');

// 1. types/index.ts
let typesContent = fs.readFileSync('FE/boxora-web/src/types/index.ts', 'utf8').replace(/\r\n/g, '\n');
typesContent = typesContent.replace(/<{7} HEAD\n  images\?: string\[\]\n  primaryImageUrl\?: string\n={7}\n  imageUrl\?: string\n>{7} [a-f0-9]+/g, '  images?: string[]\n  primaryImageUrl?: string\n  imageUrl?: string');
typesContent = typesContent.replace(/<{7} Updated upstream\n([\s\S]*?)={7}\n([\s\S]*?)>{7} Stashed changes/g, '$2');
fs.writeFileSync('FE/boxora-web/src/types/index.ts', typesContent, 'utf8');
console.log('1. types/index.ts resolved');

// 2. DashboardLayout.tsx
let dashContent = fs.readFileSync('FE/boxora-web/src/components/layout/DashboardLayout.tsx', 'utf8').replace(/\r\n/g, '\n');
dashContent = dashContent.replace(/<{7} Updated upstream\n([\s\S]*?)={7}\n([\s\S]*?)>{7} Stashed changes/g, '$2');
dashContent = dashContent.replace(/<{7} HEAD\n([\s\S]*?)={7}\n([\s\S]*?)>{7} [a-f0-9]+/g, '$2');
fs.writeFileSync('FE/boxora-web/src/components/layout/DashboardLayout.tsx', dashContent, 'utf8');
console.log('2. DashboardLayout.tsx resolved');

// 3. DocuSealSimulationModal.tsx
let docuContent = fs.readFileSync('FE/boxora-web/src/components/modals/DocuSealSimulationModal.tsx', 'utf8').replace(/\r\n/g, '\n');
docuContent = docuContent.replace(/<{7} Updated upstream\n([\s\S]*?)={7}\n([\s\S]*?)>{7} Stashed changes/g, '$2');
docuContent = docuContent.replace(/<{7} HEAD\n([\s\S]*?)={7}\n([\s\S]*?)>{7} [a-f0-9]+/g, '$2');
fs.writeFileSync('FE/boxora-web/src/components/modals/DocuSealSimulationModal.tsx', docuContent, 'utf8');
console.log('3. DocuSealSimulationModal.tsx resolved');

// 4. HandoverCheckInWorkbench.tsx
let handContent = fs.readFileSync('FE/boxora-web/src/pages/staff/components/HandoverCheckInWorkbench.tsx', 'utf8').replace(/\r\n/g, '\n');
handContent = handContent.replace(/<{7} Updated upstream\n([\s\S]*?)={7}\n([\s\S]*?)>{7} Stashed changes/g, '$2');
handContent = handContent.replace(/<{7} HEAD\n([\s\S]*?)={7}\n([\s\S]*?)>{7} [a-f0-9]+/g, '$2');
fs.writeFileSync('FE/boxora-web/src/pages/staff/components/HandoverCheckInWorkbench.tsx', handContent, 'utf8');
console.log('4. HandoverCheckInWorkbench.tsx resolved');

// 5. StaffDashboard.tsx
let staffContent = fs.readFileSync('FE/boxora-web/src/pages/staff/StaffDashboard.tsx', 'utf8').replace(/\r\n/g, '\n');
staffContent = staffContent.replace(/<{7} Updated upstream\n([\s\S]*?)={7}\n([\s\S]*?)>{7} Stashed changes/g, '$2');
staffContent = staffContent.replace(/<{7} HEAD\n([\s\S]*?)={7}\n([\s\S]*?)>{7} [a-f0-9]+/g, '$2');
fs.writeFileSync('FE/boxora-web/src/pages/staff/StaffDashboard.tsx', staffContent, 'utf8');
console.log('5. StaffDashboard.tsx resolved');

