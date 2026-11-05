// Configuración de ESLint para frontend y backend (tarea #158).
// Por ahora casi todo marca "warn" para no bloquear el código que ya existe.
// Cuando el código esté más limpio se pueden ir pasando a "error".
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "src/app/components/ui/**", "backend/certs/**"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Reglas comunes para todo el proyecto
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "no-empty": "warn",
      eqeqeq: ["warn", "always"],
      "no-useless-assignment": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },

  // Frontend (React)
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Backend (Node/Express) y archivos de configuración
  {
    files: ["backend/**/*.ts", "scripts/**", "*.{js,mjs,ts}"],
    languageOptions: { globals: globals.node },
  },

  // Pruebas
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**", "backend/test/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  // Va al final: apaga las reglas de estilo que ya maneja Prettier
  prettier,
);
