import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        "coverage" // created by Jest
    ]),
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            //"@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@next/next/no-img-element": "off",
            "react-hooks/static-components": "off",
            "react-hooks/immutability": "off",
            "react-hooks/purity": "off",
            "react-hooks/refs": "off", // TODO: June 23, 2026, fix later
            "react-hooks/set-state-in-effect": "off" // TODO: June 23, 2026, fix later
        }
    },
    {
        ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
    }
]);

export default eslintConfig;
