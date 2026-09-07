module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime', // React 18: no exige "import React" en cada archivo
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react', 'react-hooks'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    // El proyecto no usa PropTypes; no tiene sentido pedirlos.
    'react/prop-types': 'off',
    // Avisa (no rompe) por variables/importaciones sin usar, salvo que
    // empiecen con "_" (convención para "sé que no se usa, es intencional").
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
  },
};
