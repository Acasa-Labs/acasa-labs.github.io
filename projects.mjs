// Hand-written copy for projects that get a full feature on the page.
// Every other public repo in the org is listed automatically from its GitHub description.
// Version, licence, release date and download link always come from the GitHub API.

export const featured = {
  lectern: {
    name: "Lectern",
    icon: "assets/lectern-icon.png",
    summary: "A native Mac editor for code and text, with git and a terminal built in.",
    detail:
      "Written in Swift with AppKit and SwiftUI. No Electron, no accounts, no telemetry. An editor, not an IDE: it doesn't build, run or debug your code.",
    primaryAction: "Download for Mac",
    facts: [
      ["Runs on", "macOS 15 or later, Apple silicon and Intel"],
      ["Written in", "Swift, AppKit, SwiftUI"],
    ],
    features: [
      ["Editor", "Syntax highlighting for Swift, JavaScript, TypeScript, Python, shell, HTML, CSS, C-family languages, Markdown, JSON, YAML and .env files."],
      ["Previews", "Markdown with tables, task lists and Mermaid diagrams. JSON as a tree you can fold."],
      ["Workspace", "A folder sidebar, tabs, Quick Open and Find in Folder. Your last session reopens."],
      ["Source control", "Stage, commit, branch, stash and read history, using your own git, hooks and credentials."],
      ["Terminal", "Your login shell in a tab, with your .zshrc and PATH."],
      ["SSH", "Connect to hosts from ~/.ssh/config, using your Mac's own ssh and keys."],
    ],
    fromSource: [
      "git clone https://github.com/Acasa-Labs/lectern.git",
      "cd lectern",
      "./build.sh",
    ],
    fromSourceNote: "Needs Xcode 16 or later.",
    operatingSystem: "macOS 15 or later",
  },
};
