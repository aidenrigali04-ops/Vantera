import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // SAST-lite: high-signal security rules as warnings (the noisy detect-object-injection
  // and detect-non-literal-regexp are intentionally left off). Flags shell exec, dynamic
  // fs/require, eval, unsafe regex, and weak randomness so they surface in review.
  {
    plugins: { security },
    rules: {
      "security/detect-child-process": "warn",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-require": "warn",
      "security/detect-eval-with-expression": "warn",
      "security/detect-unsafe-regex": "warn",
      "security/detect-buffer-noassert": "warn",
      "security/detect-pseudoRandomBytes": "warn",
      "security/detect-new-buffer": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
