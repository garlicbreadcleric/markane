import path from "path";
import url from "url";
import fs from "fs";
import { exec } from "child_process";

import * as handlebars from "handlebars";
import slugify from "slugify";
import { DateTime } from "luxon";

export const handlebarsOptions: handlebars.RuntimeOptions = {
  helpers: {
    slug(s: any) {
      return typeof s === "string" ? slugify(s.toLowerCase()) : s;
    },
    format(f: any, d: any) {
      if (d instanceof DateTime) {
        return d.toFormat(f);
      }
      return d;
    },
    nonEmpty(xs: any) {
      if (xs == null) return false;
      if (!(xs instanceof Array)) return false;
      return xs.length > 0;
    },
  },
};

export type Predicate<T> = (t: T) => boolean;

export function everyPredicate<T>(...preds: Predicate<T>[]): Predicate<T> {
  return (t) => {
    for (const p of preds) {
      if (!p(t)) return false;
    }
    return true;
  };
}

export function somePredicate<T>(...preds: Predicate<T>[]): Predicate<T> {
  return (t) => {
    for (const p of preds) {
      if (p(t)) return true;
    }
    return false;
  };
}

export function notPredicate<T>(pred: Predicate<T>): Predicate<T> {
  return (t) => !pred(t);
}

export function isRelativeLink(s: string) {
  return !isUri(s) && !path.isAbsolute(s);
}

export function isInternalLink(s: string) {
  return /^#.*/.test(s);
}

export function isUri(s: string) {
  return url.parse(s).protocol != null;
}

export async function isFileReadable(filePath: string) {
  return await new Promise((resolve, reject) =>
    fs.access(filePath, fs.constants.R_OK, (err) => {
      if (err) resolve(false);
      resolve(true);
    })
  );
}

export async function readFile(filePath: string): Promise<Buffer> {
  return await new Promise((resolve, reject) =>
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    })
  );
}

export async function readDirFiles(dirPath: string, recursive: boolean = false, files: string[] = []) {
  const children = await new Promise<string[]>((resolve, reject) => {
    fs.readdir(dirPath, (err, files) => {
      if (err) reject(err);
      else resolve(files);
    });
  });

  for (const child of children) {
    const stats = await new Promise<fs.Stats>((resolve, reject) => {
      fs.stat(path.join(dirPath, child), (err, stats) => {
        if (err) reject(err);
        else resolve(stats);
      });
    });

    if (stats.isFile()) {
      files.push(path.join(dirPath, child));
    } else if (stats.isDirectory() && recursive) {
      await readDirFiles(path.join(dirPath, child), recursive, files);
    }
  }

  return files;
}

export async function writeFile(filePath: string, data: string | NodeJS.ArrayBufferView): Promise<void> {
  return await new Promise((resolve, reject) =>
    fs.writeFile(filePath, data, (err) => {
      if (err) reject(err);
      resolve();
    })
  );
}

export function flatten<T>(arrays: T[][]): T[] {
  const result = [];
  for (const array of arrays) {
    for (const x of array) {
      result.push(x);
    }
  }
  return result;
}

export async function execCommand(cmd: string): Promise<void> {
  await new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(stderr);
        reject(err);
      }
      resolve(stdout);
    });
  });
}

export function findIndicesOf(substr: string, str: string) {
  const substrLen = substr.length;
  if (substrLen == 0) {
    return [];
  }
  let startIndex = 0,
    index,
    indices = [];
  str = str.toLowerCase();
  substr = substr.toLowerCase();

  while ((index = str.indexOf(substr, startIndex)) > -1) {
    indices.push(index);
    startIndex = index + substrLen;
  }
  return indices;
}
