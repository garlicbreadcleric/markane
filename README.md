# Markane

_Arcane focus for Markdown spell-casting_

## Description

Markane is a command-line tool for taking Markdown notes and navigating between them. The preferred Markdown dialect is Pandoc Markdown, although you can use it with CommonMark if you don't use some Pandoc-related features. Markane features include:

- Creating notes from Handlebars templates
- Preview on hover (links, images, citations)
- Auto-completion (links, citations, snippets)
- Go-to-definition (links, citations)
- Backlinks (links, citations)
- Symbols (workspace-level, document-level)
- **\[Beta\]** Unlinked mentions

## Documentation

- [Getting started](docs/getting-started.md)
- [Editor integration](docs/editor-integration.md)
- [Template examples](docs/template-examples.md)

See also: [Markane template](https://github.com/garlicbreadcleric/markane-template).

## Features

### Auto-completion

<details>
<summary>Links</summary>

![](assets/completion-link.gif)

</details>

<details>
<summary>Citations</summary>

![](assets/completion-citation.gif)

</details>

### Preview on hover

<details>
<summary>Links</summary>

![](assets/preview-link.gif)

</details>

<details>
<summary>Citations</summary>

![](assets/preview-citation.gif)

</details>

### Go to definition

<details>
<summary>Links</summary>

![](assets/definition-link.gif)

</details>

<details>
<summary>Citations</summary>

![](assets/definition-citation.gif)

</details>

### Backlinks

<details>
<summary>Links</summary>

![](assets/reference-link.gif)

</details>

<details>
<summary>Citations</summary>

![](assets/reference-citation.gif)

</details>

### Symbols

<details>
<summary>Workspace</summary>

![](assets/symbol-workspace.gif)

</details>

<details>
<summary>Document</summary>

![](assets/symbol-document.gif)

</details>

## Similar projects

- mickael-menu's [zk](https://github.com/mickael-menu/zk) — a similar tool with a more powerful command-line interface. Supports `[[wiki-links]]` and `#hashtags` and has the ability to query notes from CLI; doesn't support `@citations` and `/snippets`.
