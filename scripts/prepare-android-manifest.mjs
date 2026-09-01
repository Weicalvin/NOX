import fs from "node:fs";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const manifest = fs.readFileSync(manifestPath, "utf8");
const permissions = [
  '    <uses-permission android:name="android.permission.INTERNET" />',
  '    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
  '    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
  '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
];
const missing = permissions.filter((permission) => !manifest.includes(permission));
if (!missing.length) {
  console.log("Android media permissions already present");
  process.exit(0);
}
const marker = '<manifest xmlns:android="http://schemas.android.com/apk/res/android">';
if (!manifest.includes(marker)) throw new Error("AndroidManifest.xml marker not found");
const updated = manifest.replace(marker, `${marker}\n\n${missing.join("\n")}`);
fs.writeFileSync(manifestPath, updated);
console.log(`Added ${missing.length} Android permission declarations`);
