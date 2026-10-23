const cp = require('child_process');
const fs = require('fs');

let oldContent = cp.execSync('git show dc54f51:BE/boxora/src/main/java/com/boxora/exception/ErrorCode.java').toString();

oldContent = oldContent.replace(
  'PERMISSION_INUSE(903',
  'PERMISSION_IN_USE(903, "Không thể xóa quyền hạn vì đang được gán cho các vai trò", HttpStatus.CONFLICT),\n    PERMISSION_INUSE(903'
);

fs.writeFileSync('BE/boxora/src/main/java/com/boxora/exception/ErrorCode.java', oldContent, 'utf8');
console.log('Restored ErrorCode.java successfully');

