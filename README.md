# Markane

_Arcane focus for Markdown spell-casting_

## Description

Markane is a command-line tool for taking Markdown notes and navigating between them. The preferred Markdown dialect is Pandoc Markdown, although you can use it with CommonMark if you don't use some Pandoc-related features. Markane features include:

- Language server
  - Clients: [VS Code](https://github.com/garlicbreadcleric/vscode-markane)
  - Title-based file auto-complete
  - Citation auto-complete
    - Currently only CSL JSON is supported
  - Title-based document search
  - Go to definition for links and Pandoc citations
    - For citations it opens file which has citation key as it's name
  - Document outline
- Creating files from templates
  - Handlebars is used for templates
  - Can use citation metadata inside the template if citation key is specified
- Snippets
  - Triggered by typing `/`
- Preprocessor
  - **Warning**: Current implementation is more of a proof of concept, expect breaking changes in future versions
  - Evaluating queries and writing the results to the Markdown file

## Installation

**Note**: Currently you'll need to clone the repository manually, but Markane will be available on NPM soon.

Requirements:

- Git
- Node.js (with npm or any other package manager)

**To do**: Specify the minimal Node.js version.

```bash
git clone https://github.com/garlicbreadcleric/markane
cd markane
sudo npm i -g
```

## Usage

### Command-line interface

```
Markane - Arcane focus for Markdown spell-casting

Commands:

markane new
  Create a new note

  -t, --title          Note title [type: string]
  -c, --citationKey    Source note citation key [type: string]
  -T, --template       Handlebars template name [type: string]
  -k, --keyword        Note keywords [type: list]

markane bibliography
  List available bibliography entries

  -c, --citationKey    Citation key (will output all citation entries if none provided) [type: string]

markane lsp
  Run language server

markane parse
  Parse Markdown and show abstract syntax representation (for development purposes only)

  -i, --input     Input file path (will read from stdin if none provided) [type: string]
  -o, --output    Output file path (will write to stdout if none provided) [type: string]
  -f, --format    Output format [values: textmate, markane; default: markane]

markane process
  Process input Markdown applying some transformations

  -i, --input     Input file path (will read from stdin if none provided) [type: string]
  -o, --output    Output file path (will write to stdout if none provided) [type: string]

markane help
  Show help message
```

### Configuration

While some basic Markane features (like preview on hover or go to definition) work out of the box, many other require a `markane.yaml` configuration file in the root of your note folder:

```yaml
# Specifies which editor will be opened for newly created notes.
editor: codium

# Specifies folders that contain Handlebars templates for creating new notes.
templates:
  - .templates

# Specifies folders that contain Markdown files with snippets.
snippets:
  - .snippets

# Specifies folders that contain notes. Currently the folders aren't recursive,
# i.e. ./notes/foo.md is included in the note collection but ./notes/bar/baz.md
# is not.
folders:
  - path: ./notes
    # A Handlebars template in the folder specified in templates field (see 
    # above). For example, in this case the template file is .templates/note.md
    template: note
    # A Handlebars template for the file name.
    file: '{{format "yyyyMMdd" now}}_{{slug title}}.md'

  - path: ./sources
    template: source
    # Citation metadata is available via the 'citationEntry' object.
    file: '{{citationEntry.citation-key}}.md'

citations:
  # Enable auto-complete for Pandoc-style citations
  autocomplete: true
  # CSL JSON bibliography file. Currently only one bibliography file per 
  # workspace is allowed.
  bibliography: ./references/bibliography.json
  # Folder that contain source notes. A source note has a citation key as it's
  # name and is a go-to-definition target for the corresponding Pandoc
  # citations.
  folders:
    - ./sources

lsp:
  # If true, the Markdown will be passed through Pandoc before showing in the
  # preview on hover. This is useful to properly preview Pandoc-specific
  # Markdown, i.e. citations, fenced divs etc.
  pandocPreview: true
```

### Preprocessor

**Warning**: Current implementation is more of a proof of concept, expect breaking changes in future versions.

There are two ways to run the preprocessor:

1. Via command-line (`markane process -i note.md -o note.md`)
2. Via language server command

The first way is not recommended, as it's indexing all the notes on every run, which takes a bit of time; the language server only needs to index once and then apply incremental changes as the files change, so running preprocessor is much faster this way.

The preprocessor finds fenced code blocks with `markane-query` language, parses their contents as queries and outputs the result to the `markane-output` fenced div following the fenced code block. If there's already `markane-output` fenced div after the code block, it's replaced, but there shouldn't be anything except whitespace between them.

Preprocessor queries are written in JavaScript with some variables in scope:

```typescript
// The document index.
declare const documents: {
  filePath: string;
  title?: string;
  metadata: any;
  elements: {
    type: "frontmatter" | "heading" | "fencedCode" | "fencedDiv" | "inlineLink" | "referenceLink" | "inlineImage" | "citation" | "comment" | "raw";
    start: { line: number, character: number };
    end: { line: number, character: number };
    content: string;
  }[];
  source?: string;
  preview?: string;
}[];

// Absolute path of the current file.
declare const filePath: string;

// Absolute path of the directory that contains the current file.
declare const dirPath: string;

declare function hasKeyword(document, keyword: string): boolean;
declare function hasEveryKeyword(document, keywords: string[]): boolean;
declare function hasSomeKeyword(document, keywords: string[]): boolean;

declare function foldElements<T>(
  f: (acc: T, element: MarkdownElement) => { acc: T, isFinished?: boolean },
  initial: T,
  elements: MarkdownElement | MarkdownElement[]
): T;

declare function mapElements<T>(
  f: (element: MarkdownElement) => T,
  elements: MarkdownElement | MarkdownElement[]
): T[];

declare function filterElements(f: (element: MarkdownElement) => boolean): MarkdownElement[];

declare function findElement(f: (element: MarkdownElement) => boolean, elements: MarkdownElement | MarkdownElement[]): MarkdownElement | null;
```

When the preprocessor is triggered, the code in `markane-query` code blocks is evaluated and the result of the last expression is written in the document inside a `markane-result` fenced div. If `markane-result` fenced div is already present, it gets rewritten.

## Issues and caveats

### Only inline links are currently supported

Support for reference links is planned. I don't really want to support wiki-links because I try to stick with what Pandoc supports out of the box, syntax-wise. It is possible I will reconsider if there are enough requests, though.

### Error handling

Currently in some cases Markane will just throw plain Node.js stacktraces without any explanation. Proper error handling and config validation are both high on the TODO list.

### Performance

Not necessarily an issue, but a thing to consider. I did some tests on larger note vaults on a MacBook Pro 2018, 16GB RAM, and it seems usable albeit starts to be a bit laggy on 10000 files with 140000 lines in total. I suspect this should be enough for most potential users (certainly is enough for me), so I won't prioritize improving performance at least until someone complains that it's actually an issue for them.

## Similar projects

- [mickael-menu's zk](https://github.com/mickael-menu/zk) — A command-line tool that I've used for a few months before starting to work on Markane. I encourage you to try both, since they are quite similar but there are some things zk is doing that Markane isn't even trying to do and vice versa.
  - Some reasons to choose zk:
    - More powerful command-line interface (queries, fzf integration)
    - Wiki-links and hashtags support
  - Some reasons to choose Markane:
    - Better Markdown parsing
    - Pandoc citations support
