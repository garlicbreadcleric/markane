import { Config } from "../config";
import { Logger } from "../logger";
import { readFile } from "../utils";

export type BibliographyEntry = {
  title: string;
  abstract: string;
  "citation-key": string;
};

export class CitationProvider {
  public bibliography: BibliographyEntry[] = [];

  constructor(protected config: Config, protected logger: Logger) {}

  async index() {
    this.bibliography = [];
    if (this.config.citations?.bibliography == null) return;

    this.bibliography = await readFile(this.config.citations.bibliography)
      .then((data) => data.toString())
      .then((json) => JSON.parse(json));
  }

  getByCitationKey(key: string): BibliographyEntry | null {
    for (const entry of this.bibliography) {
      if (entry["citation-key"] == key) return entry;
    }
    return null;
  }
}
