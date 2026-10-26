/** Replace Hebrew regexes in YonaView with \u escapes (ASCII-only source). */
import fs from "fs";

const path = "src/components/olar/views/YonaView.tsx";
let s = fs.readFileSync(path, "utf8");

const start = s.indexOf("function applyFixTransform");
const end = s.indexOf("function PhonePreview");
if (start < 0 || end < 0) throw new Error("markers not found");

const replacement = `function applyFixTransform(
  post: PostState,
  instruction: string
): PostState {
  const lower = instruction.toLowerCase();
  let { headline, body } = post;

  const shortenRe = new RegExp(
    "\\u05ea\\u05e7\\u05e6\\u05e8|\\u05e7\\u05e6\\u05e8|shorten|short",
    "i"
  );
  const dealRe = new RegExp(
    "\\u05de\\u05d1\\u05e6\\u05e2|\\u05d4\\u05e0\\u05d7\\u05d4|sale|deal",
    "i"
  );
  const waRe = new RegExp(
    "\\u05d5\\u05d5\\u05d0\\u05d8\\u05e1\\u05d0\\u05e4|whatsapp",
    "i"
  );

  if (shortenRe.test(lower) || shortenRe.test(instruction)) {
    body = body
      .split("\\n")
      .filter((l) => l.trim())
      .slice(0, 3)
      .join("\\n");
    if (headline.length > 36) headline = headline.slice(0, 34) + "...";
  } else if (dealRe.test(lower) || dealRe.test(instruction)) {
    headline = headline + " \\u2014 " + "\\u05de\\u05d1\\u05e6\\u05e2";
    body = "\\u05de\\u05d1\\u05e6\\u05e2 \\u05d4\\u05e9\\u05d1\\u05d5\\u05e2!" + "\\n" + body;
  } else if (waRe.test(lower) || waRe.test(instruction)) {
    body =
      body +
      "\\n\\n" +
      "\\u05db\\u05ea\\u05d1\\u05d5 \\u05dc\\u05e0\\u05d5 \\u05d1\\u05d5\\u05d5\\u05d0\\u05d8\\u05e1\\u05d0\\u05e4 \\u05dc\\u05ea\\u05d0\\u05d5\\u05dd \\u05de\\u05d4\\u05d9\\u05e8.";
  } else {
    body = body + "\\n\\n(" + instruction + ")";
  }

  return { ...post, headline, body };
}

`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(path, s, "utf8");
console.log("fixed applyFixTransform");
