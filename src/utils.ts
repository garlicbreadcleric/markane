import path from "path";
import url from "url";
import fs from "fs";
import { exec } from "child_process";

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

export async function writeFile(
  filePath: string,
  data: string | NodeJS.ArrayBufferView
): Promise<void> {
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
