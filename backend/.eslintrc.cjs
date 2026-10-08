module.exports = {
  root: true,
  env: { node: true, es2021: true, commonjs: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'script' },
  ignorePatterns: ['node_modules', 'db/*.db'],
  rules: {
    // H-15: una variable declarada y nunca usada hace creer a quien lee que
    // sí se usa (y lleva a "arreglar" olvidos que no existen). Es error, no
    // aviso. req/res/next sin usar son normales en middlewares de Express,
    // por eso se exceptúan.
    'no-unused-vars': ['error', { argsIgnorePattern: '^_|^req$|^res$|^next$' }],
    'no-console': 'off',
  },
};
