const setLanguageMode = (lang) => {
  switch (lang) {
    case "c++":
      return "text/x-c++src";
    case "c":
      return "text/x-c++src";
    case "csharp":
      return "text/x-csharp";
    case "go":
      return "text/x-go";
    case "java":
      return "text/x-java";
    case "kotlin":
      return "text/x-kotlin";
    case "lua":
      return "text/x-lua";
    case "pascal":
      return "text/x-pascal";
    case "perl":
      return "text/x-perl";
    case "php":
      return "text/x-php";
    case "python":
      return "text/x-python";
    case "python2":
      return "text/x-python";
    case "r":
      return "text/x-rsrc";
    case "ruby":
      return "text/x-ruby";
    case "rust":
      return "text/x-rustsrc";
    case "shell":
      return "text/x-sh";
    case "sql":
      return "text/x-sql";
    case "swift":
      return "text/x-swift";
    case "nodejs":
      return "text/javascript";
    case "javascript":
      return "text/javascript";
    case "typescript":
      return "text/typescript";
    default:
      return "";
  }
};
export default setLanguageMode;
