import path from "path";
import fs from "fs";

import * as handlebars from "handlebars";
import slugify from "slugify";
import { DateTime } from "luxon";

import { Config, FolderConfig } from "../config";
import {
  execCommand,
  handlebarsOptions,
  isFileReadable,
  readFile,
  writeFile,
} from "../utils";
import { Logger } from "../logger";
import { BibliographyEntry } from "./citation-provider";

export type CreateFileOptions = {
  title: string;
  now: DateTime;
  template: string;
  citationEntry: BibliographyEntry | null;
  keywords: string[];
  openEditor: boolean;
};

export class TemplateProvider {
  constructor(protected config: Config, protected logger: Logger) {}

  async getTemplateSource(templateName: string): Promise<string | null> {
    const cwd = process.cwd();

    for (const folder of this.config.templates ?? []) {
      const filePath = path.join(cwd, folder, `${templateName}.md`);
      const isTemplateFileReadable = await isFileReadable(filePath);

      if (isTemplateFileReadable) {
        const template = await readFile(filePath).then((data) =>
          data.toString()
        );
        return template;
      }
    }

    this.logger.warn(
      `Could not find the template '${templateName}' in specified template folders.`
    );

    return null;
  }

  getFolderConfig(folderPath: string): FolderConfig | null {
    for (const folder of this.config.folders ?? []) {
      if (
        folder.path != null &&
        !path.relative(folder.path, folderPath).startsWith("../")
      ) {
        return folder;
      }
    }
    return null;
  }

  async prepareToCreateFile(
    folderPath: string,
    options: Partial<CreateFileOptions>
  ): Promise<{ filePath: string; fileContent: string }> {
    const folderConfig = this.getFolderConfig(folderPath);
    const fileNameTemplateSource = folderConfig?.file ?? "{{ slug title }}.md";
    let fileContentTemplateSource = "";
    if (options.template != null) {
      fileContentTemplateSource =
        (await this.getTemplateSource(options.template)) ??
        fileContentTemplateSource;
    } else if (folderConfig?.template != null) {
      fileContentTemplateSource =
        (await this.getTemplateSource(folderConfig.template)) ??
        fileContentTemplateSource;
    }

    const fileNameTemplate = handlebars.compile(fileNameTemplateSource);
    const fileContentTemplate = handlebars.compile(fileContentTemplateSource);

    const templateInput = {
      now: options.now ?? DateTime.now(),
      title: options.title ?? options.citationEntry?.title ?? "Untitled",
      citationEntry: options.citationEntry,
      keywords: options.keywords ?? [],
    };

    const fileName = fileNameTemplate(templateInput, handlebarsOptions);
    const filePath = path.join(folderPath, fileName);
    const fileContent = fileContentTemplate(templateInput, handlebarsOptions);

    return { filePath, fileContent };
  }

  async createFile(folderPath: string, options: Partial<CreateFileOptions>) {
    const { filePath, fileContent } = await this.prepareToCreateFile(
      folderPath,
      options
    );

    if (await isFileReadable(filePath)) {
      this.logger.warn(`Cannot create file ${filePath} as it already exists.`);
    } else {
      await writeFile(filePath, fileContent);
      this.logger.info(`Successfully created file ${filePath}.`);
    }

    const openEditor = options.openEditor ?? true;
    if (openEditor && this.config.editor != null) {
      await execCommand(`${this.config.editor} ${filePath}`);
    }
  }
}
