#!/usr/bin/env node

import fs = require('fs');
import os = require('os');
import path = require('path');

import * as commandLineArgs from 'command-line-args';

import { IndexGenerator } from './index-generator';
import { CreateMode, HeaderMode, Options } from './options';

const args = commandLineArgs(
  [
    { name: 'config', alias: 'c', type: String },
    { name: 'path', alias: 'p', type: String, multiple: true },
    { name: 'out', alias: 'o', type: String },

    {
      name: 'mode',
      alias: 'm',
      type: (v): string | undefined =>
        Object.values(CreateMode).includes(<CreateMode>v) ? v : undefined,
    },

    { name: 'include', alias: 'i', type: String, multiple: true },
    { name: 'exclude', alias: 'e', type: String, multiple: true },

    {
      name: 'eol',
      alias: 'l',
      type: (v): string => {
        switch (v) {
          case null:
          case undefined:
          case 'os':
            return os.EOL;
          case 'unix':
          case 'lf':
          case 'n':
            return '\n';
          case 'win':
          case 'crlf':
          case 'rn':
            return '\r\n';
          case 'r':
            return '\r';
          default:
            return v;
        }
      },
    },
    { name: 'eol-at-eof', type: Boolean },

    { name: 'header', alias: 'h', type: String },
    {
      name: 'header-mode',
      type: (v): string | undefined =>
        Object.values(HeaderMode).includes(<HeaderMode>v) ? v : undefined,
    },

    { name: 'if-needed', alias: 'n', type: Boolean },

    { name: 'format', alias: 'f', type: String },
  ],
  {
    camelCase: true,
    partial: true,
  }
);

let options: Partial<Options> = {};

if (args.config) {
  const configPath = path.isAbsolute(args.config)
    ? args.config
    : path.resolve(args.config);
  if (!fs.existsSync(configPath)) {
    console.log(`Configuration file '${configPath}' is not found.`);
  } else {
    options = <Partial<Options>>(
      JSON.parse(fs.readFileSync(configPath).toString())
    );
  }
}

options = {
  paths:
    args.path ??
    options.paths ??
    (args._unknown && args._unknown.length > 0
      ? args._unknown.slice(0, args._unknown.length - 1)
      : undefined),
  output:
    args.out ??
    options.output ??
    (args._unknown && args._unknown.length > 1
      ? args._unknown[args._unknown.length - 1]
      : undefined),
  mode: args.mode ?? options.mode,
  includes:
    args.include?.map((m: string) => new RegExp(m)) ??
    // It is string, we convert it to regex
    options.includes?.map((m: RegExp) => new RegExp(m)),
  excludes:
    args.exclude?.map((m: string) => new RegExp(m)) ??
    // It is string, we convert it to regex
    options.excludes?.map((m: RegExp) => new RegExp(m)),
  newline: args.eol ?? options.newline,
  newlineAtTheEndOfFile: args.eolAtEof ?? options.newlineAtTheEndOfFile,
  header: args.header ?? options.header,
  headerMode: args.headerMode ?? options.headerMode,
  createFileOnlyIfNeeded: args.ifNeeded ?? options.createFileOnlyIfNeeded,
  format: args.format ?? options.format,
};

const generator = new IndexGenerator(options);
generator.generate();
