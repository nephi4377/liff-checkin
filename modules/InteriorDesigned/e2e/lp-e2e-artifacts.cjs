const fs = require('fs');
const os = require('os');

/** CI／本機皆可寫的 e2e 截圖目錄 */
function resolveE2eArtifactsDir() {
    const dir = process.env.LP_E2E_ARTIFACTS || os.tmpdir();
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

module.exports = { resolveE2eArtifactsDir };
