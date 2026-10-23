const fs = require('fs');

const file = 'BE/boxora/src/main/java/com/boxora/service/impl/HandoverServiceImpl.java';
let content = fs.readFileSync(file, 'utf8');

// Add import
if (!content.includes('import com.boxora.dto.request.*;')) {
  content = content.replace('import com.boxora.dto.request.HandoverRequest;', 'import com.boxora.dto.request.*;');
}

const methodsToAdd = fs.readFileSync('scratch/handover_methods.txt', 'utf8') + `
    private void cleanupUploadedFileIfOrphan(String fileUrl) {
        if (fileStorageService != null && fileUrl != null && fileUrl.trim().startsWith("/uploads/")) {
            fileStorageService.deleteFileIfExists(fileUrl.trim());
        }
    }
`;

const lastBraceIdx = content.lastIndexOf('}');
content = content.slice(0, lastBraceIdx) + '\n' + methodsToAdd + '\n}';
fs.writeFileSync(file, content, 'utf8');
console.log('Appended handover methods and cleanup helper to HandoverServiceImpl');

