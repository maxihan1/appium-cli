#!/usr/bin/env node
// appium-cli 실행 진입점. 결과는 stdout, 실패는 stderr 와 종료 코드 1

import { run } from './cli.js';

run(process.argv.slice(2)).then(
  (out) => console.log(out),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  },
);
