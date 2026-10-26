import fs from "fs";
import path from "path";

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

function isValidUtf8(buf) {
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b < 0x80) {
      i++;
      continue;
    }
    let need = 0;
    if ((b & 0xe0) === 0xc0) need = 1;
    else if ((b & 0xf0) === 0xe0) need = 2;
    else if ((b & 0xf8) === 0xf0) need = 3;
    else return false;
    for (let j = 1; j <= need; j++) {
      if (i + j >= buf.length || (buf[i + j] & 0xc0) !== 0x80) return false;
    }
    i += need + 1;
  }
  return true;
}

const roots = ["src/components/olar", "src/lib/olar"];
let fixed = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    const buf = fs.readFileSync(file);
    if (isValidUtf8(buf)) continue;
    // Lone 0xB7 middle-dots were written as Latin-1; promote via latin1->utf8
    const text = buf.toString("latin1");
    fs.writeFileSync(file, text, "utf8");
    const again = fs.readFileSync(file);
    console.log(
      path.relative(process.cwd(), file),
      isValidUtf8(again) ? "FIXED" : "STILL_BAD"
    );
    fixed++;
  }
}
console.log("fixed count", fixed);
