import globals from "globals"
import tsParser from "@typescript-eslint/parser"

import eslint from "@eslint/js"
import ts_eslint from "typescript-eslint"

export default [
    eslint.configs.recommended,
    ...ts_eslint.configs.recommended
    , {
        languageOptions: {
            globals: {
                ...globals.node,
            },

            parser: tsParser,
            ecmaVersion: "latest",
            sourceType: "commonjs",
        },

        rules: {
            indent: ["error", 4],
            quotes: ["error", "double"],
            semi: ["error", "never"],
            "@typescript-eslint/no-explicit-any": ["warn"],
            "@typescript-eslint/no-empty-object-type" : ["off"]
        },
    }]