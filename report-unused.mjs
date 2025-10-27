// report-unused.mjs
import { execSync } from "child_process";
import fs from "fs";

// unimported 실행
console.log("🧹 Checking for unused files...");
const output = execSync("npx unimported --json", { encoding: "utf-8" });
const result = JSON.parse(output);

// 미사용 파일 목록 추출
const unused = result.unusedFiles || [];
const used = result.usedFiles || [];

const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Unused File Report</title>
<style>
body { font-family: 'Pretendard', sans-serif; margin: 40px; background: #f8f9fa; }
h1 { color: #2c3e50; }
ul { list-style-type: none; padding: 0; }
li { background: #fff; margin: 8px 0; padding: 10px 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
code { color: #e67e22; font-weight: 600; }
.summary { margin-top: 30px; font-size: 14px; color: #555; }
</style>
</head>
<body>
  <h1>📦 미사용 파일 리포트</h1>
  <p>총 파일 수: ${used.length + unused.length}개</p>
  <p>미사용 파일 수: <strong>${unused.length}</strong>개</p>

  <ul>
    ${unused.map(f => `<li><code>${f}</code></li>`).join("")}
  </ul>

  <div class="summary">
    <p>📍 Generated: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
`;

// HTML로 저장
fs.writeFileSync("unused-report.html", html, "utf-8");
console.log(`✅ Report generated: unused-report.html`);
