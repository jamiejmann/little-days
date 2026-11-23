// Builds ios-app/www from the website files in the repo root, so the app ships its own copy (no remote URL).
// The website itself is not changed: native hooks are added only to this copy, and every patch must match exactly.
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { build } from 'esbuild';
const here = path.dirname(new URL(import.meta.url).pathname), app = path.resolve(here, '..'), root = path.resolve(app, '..'), www = path.join(app, 'www');
fs.rmSync(www, { recursive: true, force: true }); fs.mkdirSync(path.join(www, 'vendor'), { recursive: true });
for (const f of ['who-lms.js', 'manifest.webmanifest', 'privacy.html']) fs.copyFileSync(path.join(root, f), path.join(www, f));
fs.cpSync(path.join(root, 'icons'), path.join(www, 'icons'), { recursive: true });
for (const f of ['native.js', 'native.css']) fs.copyFileSync(path.join(app, 'native', f), path.join(www, f));

// Supabase client bundled locally (the website loads the same major version from esm.sh)
await build({ stdin: { contents: "export * from '@supabase/supabase-js';", resolveDir: app }, bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true, outfile: path.join(www, 'vendor', 'supabase.js'), logLevel: 'warning' });
// jsPDF bundled locally for the pediatrician summary PDF (window.print() does nothing inside the iOS app)
await build({ stdin: { contents: "import { jsPDF } from 'jspdf'; window.jspdf = { jsPDF };", resolveDir: app }, bundle: true, format: 'iife', platform: 'browser', target: 'es2020', minify: true, outfile: path.join(www, 'vendor', 'jspdf.js'), logLevel: 'warning' });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const patch = (from, to) => { const n = html.split(from).length - 1; if (n !== 1) throw new Error(`build-web: expected exactly one match for: ${from.slice(0, 70)} (found ${n})`); html = html.replace(from, to); };
patch("const SUPABASE_CDN='https://esm.sh/@supabase/supabase-js@2';", "const SUPABASE_CDN='./vendor/supabase.js';");
patch('</head>', '<link rel="stylesheet" href="native.css">\n</head>');
// the app never zooms: no pinch zoom, no auto-zoom when a small text field is focused
patch('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">', '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">');
patch('<script>\n(function(){', '<script src="vendor/jspdf.js" defer></script>\n<script src="native.js"></script>\n<script>\n(function(){');
patch('async function refreshPushStatus(){', 'async function refreshPushStatus(){if(window.LDNative)return LDNative.refreshPushStatus();');
patch("$('#pushOn').onclick=async()=>{", "$('#pushOn').onclick=async()=>{if(window.LDNative)return LDNative.pushOn();");
patch("$('#pushTest').onclick=async()=>{", "$('#pushTest').onclick=async()=>{if(window.LDNative)return LDNative.test();");
patch('async function dropThisDevice(){', 'async function dropThisDevice(){if(window.LDNative)await LDNative.dropThisDevice();');
patch("if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){", "if(!window.LDNative&&'serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){");
patch('window.__littledays={', "window.__ldApp={get sb(){return sb},get user(){return user},get mode(){return MODE},get data(){return D},toast:m=>toast(m),supabaseKey:SUPABASE_KEY,alarmFn:ALARM_FN};\nwindow.__littledays={");
let sha = 'dev'; try { sha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch (e) {}
const version = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).version;
patch('<script src="native.js"></script>', `<script>window.__ldBuild={version:${JSON.stringify(version)},web:${JSON.stringify(sha)}}</script>\n<script src="native.js"></script>`);
fs.writeFileSync(path.join(www, 'index.html'), html);
if (/esm\.sh/.test(html)) throw new Error('build-web: remote library URL still present');
console.log('www built from website @', sha, '| files:', fs.readdirSync(www).join(', '));
