import * as fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
const searchIndex = content.indexOf('} -20 }} className="space-y-3">');

if (searchIndex !== -1) {
    // We want to keep just "}" and remove the rest.
    content = content.substring(0, searchIndex + 1) + '\n';
    fs.writeFileSync('src/App.tsx', content);
    console.log("Truncated file successfully.");
} else {
    console.log("Search string not found!");
}
