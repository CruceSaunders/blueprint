// electron-builder configuration. Builds UNSIGNED (ad-hoc) by default so anyone can build from source.
// Release signing is opt-in through environment variables only (nothing identity-specific is committed):
//   BLUEPRINT_SIGN_IDENTITY  e.g. "Example Inc. (TEAMID1234)" (no "Developer ID Application: " prefix; electron-builder adds it)
//   APPLE_KEYCHAIN_PROFILE   a `xcrun notarytool store-credentials` profile name; when set, the app is notarized and stapled
const identity = process.env.BLUEPRINT_SIGN_IDENTITY || null;

/** @type {import("electron-builder").Configuration} */
module.exports = {
  appId: "com.cruce.blueprint",
  productName: "Blueprint",
  directories: { output: "release", buildResources: "build" },
  files: ["dist/**", "dist-electron/**", "package.json"],
  asar: true,
  npmRebuild: false,
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
  },
  mac: {
    target: [
      { target: "dmg", arch: ["arm64"] },
      { target: "zip", arch: ["arm64"] },
    ],
    icon: "build/icon.icns",
    identity: identity ?? "-",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    notarize: !!(identity && process.env.APPLE_KEYCHAIN_PROFILE),
    category: "public.app-category.productivity",
    // Stable names so .../releases/latest/download/Blueprint.dmg is a permanent link.
    artifactName: "Blueprint-mac-${arch}.${ext}",
    extendInfo: { LSUIElement: true, NSHighResolutionCapable: true },
  },
  dmg: { sign: false, writeUpdateInfo: false, artifactName: "Blueprint.dmg" },
  protocols: [{ name: "Blueprint", schemes: ["blueprint"] }],
  publish: null,
};
