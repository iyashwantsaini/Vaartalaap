import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";
// Re-enable when ruby/php/swift/sql entries below are uncommented
// import { php } from "@codemirror/lang-php";
// import { sql } from "@codemirror/lang-sql";

// Per-entry backend mappings:
//   piston   - language id for self-hosted/community Piston
//   judge0   - numeric language_id for Judge0 CE on RapidAPI
//   codex    - language id for jaagrav's CodeX API (no key required)
//   agent    - language id for Agent Code Runner (no key required, fallback for py/js/ts)
//   wandbox  - compiler id for Wandbox (no key required, supports almost everything)
export const languages = [
  {
    value: "cpp",
    label: "C++",
    extension: cpp(),
    piston: "cpp",
    judge0: 54,
    codex: "cpp",
    agent: null,
    wandbox: "gcc-head",
    template: `#include <iostream>\n\nint main() {\n    std::cout << "Hello World" << std::endl;\n    return 0;\n}`,
  },
  {
    value: "c",
    label: "C",
    extension: cpp(),
    piston: "c",
    judge0: 50,
    codex: "c",
    agent: null,
    wandbox: "gcc-head-c",
    template: `#include <stdio.h>\n\nint main() {\n    printf("Hello World\\n");\n    return 0;\n}`,
  },
  {
    value: "csharp",
    label: "C#",
    extension: cpp(),
    piston: "csharp",
    judge0: 51,
    codex: "cs",
    agent: null,
    wandbox: "mono-6.12.0.199",
    template: `using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello World");\n    }\n}`,
  },
  {
    value: "java",
    label: "Java",
    extension: java(),
    piston: "java",
    judge0: 62,
    codex: "java",
    agent: null,
    wandbox: "openjdk-jdk-22+36",
    template: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}`,
  },
  {
    value: "kotlin",
    label: "Kotlin",
    extension: java(),
    piston: "kotlin",
    judge0: 78,
    codex: null,
    agent: null,
    wandbox: null,
    template: `fun main() {\n    println("Hello World")\n}`,
  },
  {
    value: "javascript",
    label: "JavaScript",
    extension: javascript({ jsx: true }),
    piston: "javascript",
    judge0: 63,
    codex: "js",
    agent: "javascript",
    wandbox: "nodejs-20.17.0",
    template: `console.log("Hello World");`,
  },
  {
    value: "typescript",
    label: "TypeScript",
    extension: javascript({ jsx: true, typescript: true }),
    piston: "typescript",
    judge0: 74,
    codex: null,
    agent: "typescript",
    wandbox: "typescript-5.6.2",
    template: "const greet = (name: string): void => {\n    console.log(`Hello, ${name}`);\n};\n\ngreet(\"World\");",
  },
  {
    value: "python",
    label: "Python",
    extension: python(),
    piston: "python",
    judge0: 71,
    codex: "py",
    agent: "python",
    wandbox: "cpython-head",
    template: `print("Hello World")`,
  },
  {
    value: "go",
    label: "Go",
    extension: go(),
    piston: "go",
    judge0: 60,
    codex: "go",
    agent: null,
    wandbox: "go-1.23.2",
    template: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello World")\n}`,
  },
  {
    value: "rust",
    label: "Rust",
    extension: rust(),
    piston: "rust",
    judge0: 73,
    codex: null,
    agent: null,
    wandbox: "rust-1.82.0",
    template: `fn main() {\n    println!("Hello World");\n}`,
  },
  // --- Disabled for now (kept for future re-enablement) ---------------------
  // {
  //   value: "ruby",
  //   label: "Ruby",
  //   extension: python(),
  //   piston: "ruby",
  //   judge0: 72,
  //   template: `puts "Hello World"`,
  // },
  // {
  //   value: "php",
  //   label: "PHP",
  //   extension: php(),
  //   piston: "php",
  //   judge0: 68,
  //   template: `<?php\necho "Hello World\\n";\n`,
  // },
  // {
  //   value: "swift",
  //   label: "Swift",
  //   extension: cpp(),
  //   piston: "swift",
  //   judge0: 83,
  //   template: `print("Hello World")`,
  // },
  // {
  //   value: "sql",
  //   label: "SQL",
  //   extension: sql(),
  //   piston: "sqlite3",
  //   // Judge0 CE has no plain SQL runner — fall back to Piston for this one
  //   judge0: 0,
  //   template: `SELECT 'Hello World' AS greeting;`,
  // },
] as const;
