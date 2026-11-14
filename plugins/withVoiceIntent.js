const fs = require('fs');
const path = require('path');
const { withXcodeProject } = require('@expo/config-plugins');

const SWIFT = `import AppIntents
import UIKit

struct SpracheingabeIntent: AppIntent {
  static var title: LocalizedStringResource = "Spracheingabe"
  static var description = IntentDescription("Öffnet die Spracheingabe, hört zu und liest den Eintrag vor.")
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    await MainActor.run {
      guard let url = URL(string: "kindkrank://voice") else { return }
      UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }
    return .result()
  }
}

struct KindkrankShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: SpracheingabeIntent(),
      phrases: [
        "Spracheingabe in \\(.applicationName)",
        "Öffne Spracheingabe in \\(.applicationName)"
      ],
      shortTitle: "Spracheingabe",
      systemImageName: "mic.fill"
    )
  }
}
`;

/**
 * Adds an iOS App Shortcut that opens kindkrank://voice.
 * Runs only during an iOS prebuild. Android builds do not compile this file.
 */
function withVoiceIntent(config) {
  return withXcodeProject(config, (mod) => {
    const projectName = mod.modRequest.projectName;
    if (!projectName) return mod;
    const filename = 'SpracheingabeIntent.swift';
    const relative = `${projectName}/${filename}`;
    const absolute = path.join(mod.modRequest.platformProjectRoot, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, SWIFT);
    const project = mod.modResults;
    const files = project.hash?.project?.objects?.PBXFileReference ?? {};
    const exists = Object.values(files).some((file) => file && (file.path === `"${filename}"` || file.path === filename));
    if (!exists) {
      const target = project.getFirstTarget().uuid;
      const group = project.findPBXGroupKey({ name: projectName }) ?? project.getFirstProject().firstProject.mainGroup;
      project.addSourceFile(relative, { target }, group);
    }
    return mod;
  });
}

module.exports = withVoiceIntent;
