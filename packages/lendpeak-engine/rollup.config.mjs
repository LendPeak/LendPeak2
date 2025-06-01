import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import dts from 'rollup-plugin-dts';
import pkg from './package.json' assert { type: 'json' };

export default [
  // Main bundle for CJS and ESM
  {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.main, // 'dist/index.js'
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: pkg.module, // 'dist/index.esm.js'
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve(), // Resolves node_modules
      commonjs(), // Converts CommonJS modules to ES6
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true,
        inlineSources: true
      }),
    ],
    external: Object.keys(pkg.dependencies || {}), // Externalize dependencies
  },
  // Bundle .d.ts files
  {
    input: 'dist/index.d.ts', // Input is the main .d.ts file emitted by TypeScript
    output: [{ file: pkg.types, format: 'esm' }],
    plugins: [dts()], // Standard usage for ESM
  },
];
