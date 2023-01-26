# Editor integration

## VS Code / VS Codium

[VS Code Markane extension](https://github.com/garlicbreadcleric/vscode-markane) can be installed from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=garlicbreadcleric.markane) or from [Open VSX](https://open-vsx.org/extension/garlicbreadcleric/markane) if you use VS Codium.

Other extensions recommended to use with Markane:

- [Document Preview](https://github.com/garlicbreadcleric/vscode-document-preview) for previewing Pandoc Markdown with citations etc.
- [Pandoc Markdown Syntax](https://github.com/garlicbreadcleric/vscode-pandoc-markdown) for better Pandoc Markdown syntax highlighting.
- [Markdown All in One](https://github.com/yzhang-gh/vscode-markdown) for checklists, some additional types of completion and more.
- [Markdown Link Updater](https://github.com/mathiassoeholm/markdown-link-updater) for updating link paths on file renames.
- [Markdown Paste](https://github.com/telesoho/vscode-markdown-paste-image) for pasting images from clipboard.

Personally, I've disabled all the built-in Markdown support in VS Code (`vscode.markdown` and `vscode.markdown-language-features`) as the above extensions replicate all the features from them that I need, but that is not necessary to use Markane. If you want to disable built-in extensions, you can find them by entering `@builtin markdown` in the extensions search.

## \[Beta\] NeoVim

Requirements:

- [packer.nvim](https://github.com/wbthomason/packer.nvim)
- [coc.nvim](https://github.com/neoclide/coc.nvim)

```viml
require('packer').startup(function (use)
  use 'wbthomason/packer.nvim'
  use {'neoclide/coc.nvim', branch = 'release'}
end)
```

After you've installed coc.nvim, run `:CocConfig` command to open `coc-settings.json` file, and then add the following configuration:

```json
{
  "languageserver": {
    "markane": {
      "command": "markane",
      "args": ["lsp"],
      "rootPatterns": ["markane.yaml"],
      "filetypes": ["markdown"]
    }
  }
}
```

If you've never used coc.nvim before, it's also recommended that you look into it's [example Lua configuration](https://github.com/neoclide/coc.nvim#example-lua-configuration) as it provides reasonable default keybindings for common LSP features.

Other plugins recommended to use with Markane:

- [vim-pandoc-syntax](https://github.com/vim-pandoc/vim-pandoc-syntax) for better Pandoc Markdown syntax highlighting
