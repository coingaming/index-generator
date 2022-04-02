#!/usr/bin/env node

import os = require('os');

import * as commandLineArgs from 'command-line-args';

import { IndexGenerator } from './index-generator';
import { CreateMode, HeaderMode, Options } from './options';

const args = commandLineArgs(
  [
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

const options: Partial<Options> = {
  paths:
    args.path ??
    (args._unknown && args._unknown.length > 0
      ? args._unknown.slice(0, args._unknown.length - 1)
      : undefined),
  output:
    args.out ??
    (args._unknown && args._unknown.length > 1
      ? args._unknown[args._unknown.length - 1]
      : undefined),
  mode: args.mode,
  includes: args.include?.map((m: string) => new RegExp(m)),
  excludes: args.exclude?.map((m: string) => new RegExp(m)),
  newline: args.eol,
  newlineAtTheEndOfFile: args.eolAtEof,
  header: args.header,
  headerMode: args.headerMode,
  createFileOnlyIfNeeded: args.ifNeeded,
  format: args.format,
};

const generator = new IndexGenerator(options);
generator.generate();
