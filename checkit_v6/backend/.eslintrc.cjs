module.exports = {
  root: true,
  env: { node: true, es2021: true, commonjs: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'script' },
  ignorePatterns: ['node_modules', 'db/*.db'],
  rules: {
    // req/res/next sin usar son normalísimos en middlewares de Express;
    // no los marca como error.
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^req$|^res$|^next$' }],
    'no-console': 'off',
  },
};
