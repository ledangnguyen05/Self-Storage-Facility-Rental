const fs = require('fs');
let c = fs.readFileSync('FE/boxora-web/src/pages/public/UnitsExplorerPage.tsx', 'utf8');
const target = 'floorLocation: `${cleanFloor}`,';
const replacement = 'floorLocation: `${cleanFloor}`,\n        floorLevel: cleanFloor,';
if (c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync('FE/boxora-web/src/pages/public/UnitsExplorerPage.tsx', c, 'utf8');
  console.log('Successfully inserted floorLevel!');
} else {
  console.log('Target still not found. Let us search for cleanFloor');
  const idx = c.indexOf('cleanFloor');
  console.log('cleanFloor found at', idx, c.substring(idx - 50, idx + 200));
}

