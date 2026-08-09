import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "build",
      "dist",
      "coverage",
      ".netlify",
      "playwright-report",
      "test-results",
      "public/catalog.json"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        crypto: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        Response: "readonly",
        TextEncoder: "readonly",
        HTMLButtonElement: "readonly",
        KeyboardEvent: "readonly",
        btoa: "readonly",
        navigator: "readonly",
        __GITHUB_REPOSITORY__: "readonly",
        __GITHUB_REPOSITORY_URL__: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly"
      }
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  },
  {
    files: [
      "service/**/*.ts",
      "netlify/functions/**/*.ts",
      "tests/fixtures/setupService.ts",
      "tests/unit/setupService*.ts"
    ],
    languageOptions: {
      globals: {
        AbortSignal: "readonly",
        Buffer: "readonly"
      }
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        console: "readonly"
      }
    }
  },
  prettier
];
