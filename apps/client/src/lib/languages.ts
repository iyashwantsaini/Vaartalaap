import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";

export const languages = [
  { 
    value: "cpp", 
    label: "C++", 
    extension: cpp(), 
    piston: "cpp",
    template: `#include <iostream>\n\nint main() {\n    std::cout << "Hello World" << std::endl;\n    return 0;\n}`
  },
  { 
    value: "c", 
    label: "C", 
    extension: cpp(), 
    piston: "c",
    template: `#include <stdio.h>\n\nint main() {\n    printf("Hello World\\n");\n    return 0;\n}`
  },
  { 
    value: "javascript", 
    label: "JavaScript", 
    extension: javascript({ jsx: true }), 
    piston: "javascript",
    template: `console.log("Hello World");`
  },
  { 
    value: "python", 
    label: "Python", 
    extension: python(), 
    piston: "python",
    template: `print("Hello World")`
  },
  { 
    value: "java", 
    label: "Java", 
    extension: java(), 
    piston: "java",
    template: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}`
  },
] as const;
