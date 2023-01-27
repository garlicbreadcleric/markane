import { exec } from "child_process";

export type PandocLanguage = {
  name: "markdown" | "commonmark" | "commonmark_x";
  enabledExtensions: string[];
  disabledExtensions: string[];
};

export type PandocOptions = {
  cwd?: string;
  from: PandocLanguage;
  to: PandocLanguage;
  wrap: "auto" | "none" | "preserve";
  citeproc: boolean;
  metadata: {
    [key: string]: string;
  };
};

export async function convert(input: string, options: Partial<PandocOptions>): Promise<string> {
  const o: PandocOptions = Object.assign(
    {
      from: { name: "markdown", enabledExtensions: [], disabledExtensions: [] },
      to: { name: "commonmark", enabledExtensions: [], disabledExtensions: [] },
      wrap: "none",
      citeproc: true,
      metadata: {},
    },
    options
  );

  const args = [
    "--from",
    `${o.from.name}${o.from.enabledExtensions.map((e) => "+" + e).join("")}${o.from.disabledExtensions
      .map((e) => "-" + e)
      .join("")}`,
    "--to",
    `${o.to.name}${o.to.enabledExtensions.map((e) => "+" + e).join("")}${o.to.disabledExtensions
      .map((e) => "-" + e)
      .join("")}`,
  ];
  if (o.citeproc) {
    args.push("-C");
  }
  if (o.wrap) {
    args.push("--wrap");
    args.push("none");
  }
  for (const metadataKey in Object.keys(o.metadata)) {
    args.push("--metadata");
    args.push(`${metadataKey}:${o.metadata[metadataKey]}`);
  }

  return await new Promise((resolve, reject) => {
    const p = exec(`pandoc ${args.join(" ")}`, { cwd: o.cwd }, (err, stdout, stderr) => {
      if (err) {
        console.error(stderr);
        reject(err);
      }
      resolve(stdout);
    });
    p.stdin?.setDefaultEncoding("utf-8");
    p.stdin?.write(input);
    p.stdin?.end();
  });
}
