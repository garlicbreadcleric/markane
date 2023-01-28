import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { readFile } from "../utils";

export type Snippet = {
  title: string;
  text: string;
};

export class SnippetProvider {
  public snippets: Snippet[] = [];

  constructor(protected config: Config) {}

  async index() {
    this.snippets = [];

    const cwd = process.cwd();

    for (const folder of this.config.snippets ?? []) {
      const folderPath = path.resolve(cwd, folder);
      const filePaths = await new Promise<string[]>((resolve, reject) =>
        fs.readdir(folderPath, (err, files) => {
          if (err) reject(err);
          else resolve(files);
        })
      ).then((files) => files.filter((f) => path.extname(f) === ".md"));

      for (const filePath of filePaths) {
        if (path.extname(filePath) !== ".md") continue;
        const text = await readFile(path.join(folderPath, filePath)).then((data) => data.toString());

        this.snippets.push({
          title: filePath.split(".").slice(0, -1).join("."),
          text,
        });
      }
    }
  }
}
