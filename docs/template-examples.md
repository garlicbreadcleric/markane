# Template examples

## Permanent note (with Pandoc bibliogrpahy)

```markdown
---
bibliography: ../references/bibliography.json
csl: ../references/modern-language-association.csl
link-citations: true
link-bibliography: true
{{#if (nonEmpty keywords)~}}
  keywords:
  {{#each keywords~}}
    - {{this}}
  {{/each}}
{{/if}}
---

# {{title}}

## Bibliography

::: {#refs}
:::
```

## Literature note (fetching bibliographic data from a CSL JSON file)

```markdown
---
bibliography: ../references/bibliography.json
csl: ../references/modern-language-association.csl
link-citations: true
link-bibliography: true
nocite: '@{{citationEntry.citation-key}}'{{#if citationEntry.URL}}
url: {{citationEntry.URL}}{{/if}}
---

# {{#if citationEntry.author}}{{citationEntry.author.[0].family}}, {{citationEntry.author.[0].given}}{{#if citationEntry.author.[1]}} et al{{/if}}. {{/if}}_{{citationEntry.title}}_. {{#if citationEntry.original-date}}{{citationEntry.original-date.date-parts.[0]}}{{^}}{{citationEntry.issued.date-parts.[0]}}{{/if}}.

## Bibliography

::: {#refs}
:::
```

## Daily journal entry

```markdown
# {{format "yyyy-MM-dd" now}}
```
