import yaml from "yaml";

import * as utils from "./utils";

export type FolderConfig = {
  path?: string;
  type?: string;
  template?: string;
  file?: string;
  recursive?: boolean;
};

export type Config = {
  editor?: string;
  logLevel?: string;
  templates?: string[];
  snippets?: string[];
  folders?: FolderConfig[];
  citations?: {
    autocomplete?: boolean;
    bibliography?: string;
    folders?: string[];
  };
  pandocPreview?: boolean;
};

export async function getConfig(): Promise<Config | null> {
  const configReadable = await utils.isFileReadable("./markane.yaml");
  if (!configReadable) return null;

  const configSrc = await utils
    .readFile("./markane.yaml")
    .then((data: Buffer) => data.toString());
  return yaml.parse(configSrc);
}
