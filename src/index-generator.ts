import fs = require('fs');
import os = require('os');
import path = require('path');

import { CreateMode, HeaderMode, Options } from './options';

/** Regex to match the ignore comment. */
const ignoreFile = /^\s*\/\/\s*index-generator-ignore/m;

/** Regex to mach any exports. */
const hasExportFile = /^\s*export /m;

const defaultHeader = `This file was generated by a tool.
Do not modify it.`;

/**
 * Index generator.
 */
export class IndexGenerator {
  private _options: Options;

  constructor(options: Partial<Options>) {
    this._options = {
      paths: options.paths ?? ['.'],
      createFileOnlyIfNeeded: options.createFileOnlyIfNeeded ?? true,
      excludes: options.excludes ?? [],
      format: options.format ?? "export * from '{rel}/{name}';",
      header: options.header ?? defaultHeader,
      headerMode: options.headerMode ?? HeaderMode.MultilineComment,
      includes: options.includes ?? [/\.ts$/],
      newline: options.newline ?? os.EOL,
      mode: options.mode ?? CreateMode.Path,
      output: options.output ?? 'index.ts',
      newlineAtTheEndOfFile: options.newlineAtTheEndOfFile ?? true,
      writeFile: options.writeFile,
    };

    this._options.header = this.prepareHeader();

    if (this._options.mode === CreateMode.PerFolder) {
      this._options.excludes.push(
        new RegExp(`/${path.basename(this._options.output)}$`)
      );
    }
  }

  /** Generate the index file. */
  public generate(): void {
    const files: string[] = [];
    let out = this.getAbsolutePath(this._options.output);

    for (let root of this._options.paths) {
      root = this.getAbsolutePath(root);

      if (this._options.mode === CreateMode.Root) {
        out = this.getAbsolutePath(this._options.output, root);
      }

      switch (this._options.mode) {
        case CreateMode.Root:
          this.writeFile(
            out,
            this.mapToExport(out, this.collectFiles(root), root)
          );
          break;
        case CreateMode.Path:
          files.push(...this.mapToExport(out, this.collectFiles(root), root));
          break;
        case CreateMode.PerFolder:
          this.collectFilesPerFolder(root);
          break;
        case CreateMode.PerFolderWithSub:
          this.collectFilesPerFolderWithSub(root);
          break;
      }
    }

    if (this._options.mode === CreateMode.Path) {
      this.writeFile(out, files);
    }
  }

  /**
   * Prepare the header in the options.
   *
   * @returns The prepared header.
   */
  private prepareHeader(): string {
    switch (this._options.headerMode) {
      case HeaderMode.Disabled:
        return '';
      case HeaderMode.Raw:
        return this._options.header;
      case HeaderMode.MultilineComment:
        return `/*${this._options.newline}${this._options.header
          .replace(/\r?\n/, '\n')
          .split('\n')
          .map((m) => ` * ${m}`)
          .join(this._options.newline)}${this._options.newline} */`;
      case HeaderMode.SinglelineComment:
        return this._options.header
          .replace(/\r?\n/, '\n')
          .split('\n')
          .map((m) => `// ${m}`)
          .join(this._options.newline);
    }
  }

  /**
   * Get the absolute path.
   *
   * @param value The original path.
   * @param relativeTo The path that the original path is relative to, defaults to cwd.
   * @returns The absolute path.
   */
  private getAbsolutePath(value: string, relativeTo?: string): string {
    return path.isAbsolute(value)
      ? value
      : path.join(relativeTo ?? process.cwd(), value);
  }

  /**
   * Write out a file.
   *
   * @param out The output file path.
   * @param exports The export lines.
   * @returns If the output file was created.
   */
  private writeFile(out: string, exports: string[]): boolean {
    let text = this._options.header;

    if (exports.length > 0) {
      if (text) {
        text += this._options.newline;
        text += this._options.newline;
      }

      for (let i = 0; i < exports.length - 1; i++) {
        text += exports[i] + this._options.newline;
      }

      text += exports[exports.length - 1];
    } else {
      if (this._options.createFileOnlyIfNeeded) {
        if (this._options.writeFile) {
          this._options.writeFile(out, '');
        } else if (fs.existsSync(out)) {
          fs.rmSync(out);
        }

        return false;
      }
    }

    if (this._options.newlineAtTheEndOfFile) {
      text += this._options.newline;
    }

    if (this._options.writeFile) {
      this._options.writeFile(out, text);
    } else {
      fs.writeFileSync(out, text);
    }

    return true;
  }

  /**
   * Map files to exports.
   *
   * @param out The out path.
   * @param files The files.
   * @param root The root path.
   * @returns The exports.
   */
  private mapToExport(out: string, files: string[], root: string): string[] {
    const result: string[] = [];

    for (const file of files) {
      if (out === path.join(root, file)) continue;

      const ext = path.extname(file);
      const name = path.basename(file, ext);
      const dir_name = path.basename(path.dirname(file));
      const rel = path.dirname(file);
      const abs = path.join(root, rel);

      result.push(
        this._options.format.replace(/\{.*?\}/g, (m) => {
          switch (m) {
            case '{name}':
              return name;
            case '{dir_name}':
              return dir_name;
            case '{ext}':
              return ext;
            case '{rel}':
              return rel;
            case '{abs}':
              return abs;
            default:
              return m;
          }
        })
      );
    }

    return result;
  }

  /**
   * Collects the file names relative to the start folder.
   *
   * @param folder Folder to collect.
   * @param relativePath Relative path.
   * @param files Files array to append.
   * @returns The file names with relative path.
   */
  private collectFiles(
    folder: string,
    relativePath: string = '',
    files: string[] = []
  ): string[] {
    const names = fs.readdirSync(folder);

    for (const name of names) {
      const currentAbsolute = path.join(folder, name);
      const currentRelative = path.join(relativePath, name).replace(/\\/g, '/');

      if (fs.statSync(currentAbsolute).isDirectory()) {
        this.collectFiles(currentAbsolute, currentRelative, files);
      } else if (this._options.includes.some((e) => e.test(currentRelative))) {
        if (!this._options.excludes.some((e) => e.test(currentRelative))) {
          const content = fs.readFileSync(currentAbsolute).toString();
          if (!ignoreFile.test(content) && hasExportFile.test(content)) {
            files.push('./' + currentRelative);
          }
        }
      }
    }

    return files;
  }

  /**
   * Collects the file names relative to the start folder.
   *
   * @param folder Folder to collect.
   * @param relativePath Relative path.
   * @returns The file names with relative path.
   */
  private collectFilesPerFolder(
    folder: string,
    relativePath: string = ''
  ): string[] {
    const names = fs.readdirSync(folder);

    let local: string[] = [];

    for (const name of names) {
      const currentAbsolute = path.join(folder, name);
      const currentRelative = path.join(relativePath, name).replace(/\\/g, '/');

      if (fs.statSync(currentAbsolute).isDirectory()) {
        local.push(
          ...this.collectFilesPerFolder(currentAbsolute, currentRelative).map(
            (m) => './' + path.join(name, m).replace(/\\/g, '/')
          )
        );
      } else if (this._options.includes.some((e) => e.test(currentRelative))) {
        if (!this._options.excludes.some((e) => e.test(currentRelative))) {
          const content = fs.readFileSync(currentAbsolute).toString();
          if (!ignoreFile.test(content) && hasExportFile.test(content)) {
            local.push('./' + name);
          }
        }
      }
    }

    const out = this.getAbsolutePath(this._options.output, folder);

    local = local.filter((f) => !f.endsWith('/' + this._options.output));

    this.writeFile(
      out,
      this.mapToExport(
        out,
        local.filter((f) => !f.endsWith('/' + this._options.output)),
        folder
      )
    );

    return local;
  }

  /**
   * Collects the file names relative to the start folder.
   *
   * @param folder Folder to collect.
   * @param relativePath Relative path.
   * @returns The file names with relative path.
   */
  private collectFilesPerFolderWithSub(
    folder: string,
    relativePath: string = ''
  ): boolean {
    const names = fs.readdirSync(folder);

    const local: string[] = [];

    for (const name of names) {
      const currentAbsolute = path.join(folder, name);
      const currentRelative = path.join(relativePath, name).replace(/\\/g, '/');
      if (fs.statSync(currentAbsolute).isDirectory()) {
        if (
          this.collectFilesPerFolderWithSub(currentAbsolute, currentRelative)
        ) {
          local.push(
            './' + path.join(name, this._options.output).replace(/\\/g, '/')
          );
        }
      } else if (this._options.includes.some((e) => e.test(currentRelative))) {
        if (!this._options.excludes.some((e) => e.test(currentRelative))) {
          const content = fs.readFileSync(currentAbsolute).toString();
          if (!ignoreFile.test(content) && hasExportFile.test(content)) {
            local.push('./' + name);
          }
        }
      }
    }

    const out = this.getAbsolutePath(this._options.output, folder);

    return this.writeFile(out, this.mapToExport(out, local, folder));
  }
}
