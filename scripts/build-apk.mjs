#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sdk = process.env.ANDROID_SDK_ROOT || join(root, ".android-sdk");
const buildTools = join(sdk, "build-tools", "34.0.0");
const androidJar = join(sdk, "platforms", "android-34", "android.jar");
const javaHome = process.env.JAVA_HOME || "/usr/lib/jvm/java-17-openjdk-amd64";
const work = "/tmp/nox-apk-build";
const srcMain = join(root, "android/app/src/main");
const www = join(srcMain, "assets/www");
const keystore = join(root, "android/nox.keystore");
const artifacts = join(root, "artifacts");
const publicDir = join(root, "public");

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}/bin:${process.env.PATH}` },
    ...opts,
  });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (${res.status})`);
  }
}

function mustFile(p) {
  if (!existsSync(p)) throw new Error(`Missing ${p}`);
}

function listClassFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.name.endsWith(".class")) out.push(p);
    }
  };
  walk(dir);
  if (out.length === 0) throw new Error("no class files");
  return out;
}

mustFile(androidJar);
mustFile(join(buildTools, "aapt"));
mustFile(join(buildTools, "d8"));
mustFile(join(buildTools, "zipalign"));
mustFile(join(buildTools, "apksigner"));

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(artifacts, { recursive: true });

console.log("==> launcher icons");
run("python3", [join(root, "scripts/make-launcher-icons.py")]);

console.log("==> web bundle");
run("npx", ["vite", "build", "--config", "vite.apk.config.ts"], { cwd: root });

for (const extra of ["fonts", "favicon.svg", "icon-192.png", "icon-512.png"]) {
  const from = join(publicDir, extra);
  const to = join(www, extra);
  if (!existsSync(from)) continue;
  if (statSync(from).isDirectory()) cpSync(from, to, { recursive: true });
  else {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}

mustFile(join(www, "index.html"));

if (!existsSync(keystore)) {
  console.log("==> keystore");
  run("keytool", [
    "-genkeypair",
    "-keystore",
    keystore,
    "-alias",
    "nox",
    "-keyalg",
    "RSA",
    "-keysize",
    "2048",
    "-validity",
    "10000",
    "-storepass",
    "nox-player-2026",
    "-keypass",
    "nox-player-2026",
    "-dname",
    "CN=NOX Player, OU=NOX, O=NOX, L=Taipei, ST=Taiwan, C=TW",
  ]);
}

const classes = join(work, "classes");
mkdirSync(classes, { recursive: true });
console.log("==> javac");
run("javac", [
  "--release",
  "8",
  "-encoding",
  "UTF-8",
  "-cp",
  androidJar,
  "-d",
  classes,
  join(srcMain, "java/app/nox/player/MainActivity.java"),
]);

const dexDir = join(work, "dex");
mkdirSync(dexDir, { recursive: true });
console.log("==> d8");
run(join(buildTools, "d8"), [
  `--lib=${androidJar}`,
  "--min-api",
  "26",
  "--output",
  dexDir,
  ...listClassFiles(classes),
]);

const unsigned = join(work, "unsigned.apk");
console.log("==> aapt package");
run(join(buildTools, "aapt"), [
  "package",
  "-f",
  "-M",
  join(srcMain, "AndroidManifest.xml"),
  "-S",
  join(srcMain, "res"),
  "-A",
  join(srcMain, "assets"),
  "-I",
  androidJar,
  "-F",
  unsigned,
]);

console.log("==> add classes.dex");
run(join(buildTools, "aapt"), ["add", unsigned, "classes.dex"], { cwd: dexDir });

const aligned = join(work, "aligned.apk");
console.log("==> zipalign");
run(join(buildTools, "zipalign"), ["-f", "-p", "4", unsigned, aligned]);

const signed = join(work, "NOX-Player.apk");
console.log("==> apksigner");
run(join(buildTools, "apksigner"), [
  "sign",
  "--ks",
  keystore,
  "--ks-key-alias",
  "nox",
  "--ks-pass",
  "pass:nox-player-2026",
  "--key-pass",
  "pass:nox-player-2026",
  "--v1-signing-enabled",
  "true",
  "--v2-signing-enabled",
  "true",
  "--out",
  signed,
  aligned,
]);

run(join(buildTools, "apksigner"), ["verify", "--verbose", signed]);

const bytes = readFileSync(signed);
const sha = createHash("sha256").update(bytes).digest("hex");
const sizeMb = (bytes.length / (1024 * 1024)).toFixed(1);
writeFileSync(join(publicDir, "nox-player.sha256"), `${sha}  NOX-Player.apk\n`);
copyFileSync(signed, join(publicDir, "nox-player.apk"));
copyFileSync(signed, join(artifacts, "NOX-Player.apk"));
writeFileSync(
  join(publicDir, "nox-player.json"),
  JSON.stringify({ version: "1.0.0", sha256: sha, bytes: bytes.length, sizeMb }, null, 2),
);

console.log(`==> APK ready ${sizeMb} MB  sha256 ${sha}`);
console.log(`    ${join(publicDir, "nox-player.apk")}`);
console.log(`    ${join(artifacts, "NOX-Player.apk")}`);
