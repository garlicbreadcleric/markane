# Getting started

## Set up

In order to start using Markane, you need to do a few things:

1. [Install](https://github.com/garlicbreadcleric/markane#installation) Markane: `npm i -g markane`.
2. Configure LSP integration for your editor (see [Editor integration](editor-integration.md)).
3. Create `markane.yaml` configuration file in your workspace root.
4. Create folders for your notes.
5. (Optional) Set up CSL JSON bibliography and connect it via `citations` section in `markane.yaml`. For example, if you use Zotero, you can set up CSL JSON export via [Better BibTex](https://retorque.re/zotero-better-bibtex/) Zotero plugin.

Instead of writing a configuration file and adding templates and snippets from scratch, you can clone [Markane template](https://github.com/garlicbreadcleric/markane-template) repo. In this case you'll still need to follow the steps 1, 2 and 5 from the list above.

## Configuration

Markane is configured via `markane.yaml` file in your workspace root.

```yaml
# This editor will be used to open newly created notes.
editor: codium

# Handlebars templates for new files, created using `markane new` or LSP code
# actions.
templates:
  - .templates

# Handlebars templates for snippets, triggered by `/`
snippets:
  - .snippets

# All indexed folders. File names are Handlebars templates as well.
folders:
  - path: ./notes
    type: note
    template: note
    file: '{{format "yyyyMMdd" now}}_{{slug title}}.md'
  
  - path: ./journals
    type: note
    template: journal
    file: '{{format "yyyyMM" now}}.md'

  - path: ./sources
    type: note
    template: source
    file: '{{citationEntry.citation-key}}.md'

citations:
  # Triggered by `@`.
  autocomplete: true
  # CSL JSON file path.
  bibliography: ./references/bibliography.json
  folders:
    - ./sources

# If true, the Markdown preview on hover will be passed through Pandoc before
# showing. This can be helpful to handle Pandoc-specific syntax, like fenced
# divs/spans or ASCII typography.
pandocPreview: true
```

## Templates

When you create a new file (e.g. via `markane new notes -t "My new note title"`), a template is selected based on the folder that you're creating a note in. The template can be overriden via `-T/--template` flag. Templates use Handlebars to insert metadata during note creation, the available values are:

- `now` --- current date/time
- `title` --- a title that was passed via `-t/--title` flag
- `citationEntry` --- an object containing fields from a CSL JSON bibliogrpahy entry; requires a citation key to be passed via `-c/--citationKey` flag
- `keywords` --- a list of keywords passed via `-k/--keyword` flag

**Note**: `citationEntry` will only be accessible if the `citations` section in `markane.yaml` is configured.

Also some custom helpers are available:

- `slug(s)` --- slugifies string `s`
- `format(f, d)` --- formats date `d` using format `f` (e.g. `"yyyy-MM-dd"`)
- `nonEmpty(xs)` --- returns `true` if array `xs` is not empty, otherwise `false`

See also: [Template examples](template-examples.md).

## CLI

Description:

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

markane help
  Show help message

markane version
  Show installed Markane version
```

Examples:

```bash
# Create note with title "My note title"
markane new notes -t "My note title"

# Create or open a journal entry
markane new journal

# Create source note with citation key "abelson_sicp_en_1984"
markane new sources -c "abelson_sicp_en_1984"

# Get a detailed CLI description
markane help
```

The positional argument that goes after `markane new` is a folder that you want to create a note in. Other parameters are passed using flags.

## Auto-completion

Markane offers three types of auto-completion:

- Note auto-completion, triggered by `[`. Shows the list of note titles and resolves them to Markdown links.
- Citation auto-completion, triggered by `@`. Shows the list of CSL JSON entries and resolves them to Pandoc citations.
- Snippet auto-completion, triggered by `/`. Shows the list of snippet names and resolves them to snippets (processed as Handlebars templates).

**Note**: Citation auto-completion won't work if you've commented out the `citations` section in `markane.yaml`.

## Citations and source notes

As was stated above, Markane offers optional citations support. Here's an configuration snippet for enabling it:

```yaml
citations:
  autocomplete: true
  bibliography: ./references/bibliography.json
  folders:
    - ./sources
```

Here `./references/bibliography.json` is the path (relative to the workspace root) of the CSL JSON bibliography file. If you're using Zotero, you can use Better BibTex plugin and configure it to write the bibliography to this path.

In this snippet there's also a `folders` field with a list of folder paths. These are "source note paths", which means that these notes are associated with the corresponding bibliography entries. Currently the source notes must have the citation keys of the corresponding bibliography entries as their file names.

When you use a citation and there's a corresponding source note, you can use "go to definition" LSP feature to quickly jump to the source note; if the source note doesn't exist yet, you can create it via a code action (see below). This is done to reduce the friction between Markane and a reference manager and allow you to basically use citations as links to your notes on given sources.

## Code actions

There are currently two types of code actions in Markane:

- _Create a new note_. This code action is always available on a non-empty text selection. It creates a new note using the selected text as title (as if it was passed via `-t/--title` flag) and replaces the selected text with a link to created note. The note is created in the first folder listed in `folders` section of your `markane.yaml` (`./notes` in case of this repository).
- _Create a new source note_. This code action is available when the cursor is on the citation key that doesn't have a matching source note. It creates a new source note using the selected citation key (as if it was passed via `-c/--citationKey` flag). The note is created in the first folder listed in `citations.folders` section of your `markane.yaml` (`./sources` in case of this repository).