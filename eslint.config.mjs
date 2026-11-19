import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**", // incluye sw.js generado por serwist
      "next-env.d.ts",
      "components/ui/**", // shadcn/ui generado: no se edita a mano
      "hooks/use-toast.ts", // también generado por shadcn
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Prefijo "_" = descartado a propósito (p. ej. sacar un campo con rest).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
]

export default eslintConfig
