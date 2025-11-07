import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,

    {
        plugins: {
            react,
            "react-hooks": reactHooks,
            "jsx-a11y": jsxA11y,
        },
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
            ecmaVersion: "latest",
            sourceType: "module",
        },
        settings: {
            react: { version: "detect" },
        },
        rules: {
            // React Hooks rules
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",

            // Accessibility rules
            "jsx-a11y/alt-text": "warn",
            "jsx-a11y/no-autofocus": "warn",

            // TypeScript rules
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": "off",

            // Code Style
            "prefer-const": "error",
            "no-var": "error",
            "react/react-in-jsx-scope": "off",
        },
    },

    {
        ignores: ["dist/", "build/", "node_modules/", "*.config.*"],
    }
);
