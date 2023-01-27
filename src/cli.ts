import { Logger } from "./logger";

export type CliOptions = {
  executableName?: string;
  description?: string;
  commands: {
    [name: string]: CliCommand;
  };
};

export type CliCommand = {
  description?: string;
  options?: {
    [name: string]: CliCommandOption;
  };
};

export type CliCommandOption = {
  short?: string;
  description?: string;
  type?: CliCommandOptionType;
  default?: any;
  oneOf?: string[];
};

export enum CliCommandOptionType {
  List = "list",
  String = "string",
  Flag = "flag",
}

export type CliParsedOptions = {
  command: string;
  options: {
    [name: string]: any;
  };
  arguments: string[];
};

export class CliParser {
  constructor(protected options: CliOptions, protected logger: Logger) {}

  parse(argv: string[]) {
    if (argv.length === 0) {
      console.log(this.help());
      process.exit(0);
    }

    const command = this.getCommand(argv[0]);

    const result: CliParsedOptions = {
      command: argv[0],
      options: this.getDefaultOptions(command),
      arguments: [],
    };

    let i = 1;
    while (i < argv.length) {
      const arg = argv[i];
      if (arg.slice(0, 4) === "--no-") {
        const optionName = arg.slice(4);
        const option = (command.options ?? {})[optionName];
        if (option == null) {
          this.logger.error(`Unknown option ${arg} of command ${argv[0]}.`);
          process.exit(1);
        }
        if (option.type !== "flag") {
          this.logger.error(`Option --${optionName} is not a flag and can't be negated.`);
        }
        result.options[optionName] = false;
      } else if (arg.slice(0, 2) === "--") {
        const optionName = arg.slice(2);
        const option = (command.options ?? {})[optionName];
        if (option == null) {
          this.logger.error(`Unknown option ${arg} of command ${argv[0]}.`);
          process.exit(1);
        }
        if (option.type === "flag") {
          result.options[optionName] = true;
        } else {
          i++;
          if (i >= argv.length) {
            this.logger.error(`Option ${arg} is not a flag, a value must be provided.`);
            process.exit(1);
          }

          if (option.type === "list") {
            if (result.options[optionName] == null) {
              result.options[optionName] = [];
            }
            result.options[optionName].push(argv[i]);
          } else {
            result.options[optionName] = argv[i];
          }
        }
      } else if (arg.length === 2 && arg[0] === "-") {
        const optionShortName = arg[1];
        const optionName = this.getOptionNameByShortName(optionShortName, command);
        if (optionName == null) {
          this.logger.error(`Unknown option ${arg} of command ${argv[0]}.`);
          process.exit(1);
        }
        const option = (command.options ?? {})[optionName];
        if (option.type === "flag") {
          result.options[optionName] = true;
        } else {
          i++;
          if (i >= argv.length) {
            this.logger.error(`Option ${arg} is not a flag, a value must be provided.`);
            process.exit(1);
          }

          if (option.type === "list") {
            if (result.options[optionName] == null) {
              result.options[optionName] = [];
            }
            result.options[optionName].push(argv[i]);
          } else {
            result.options[optionName] = argv[i];
          }
        }
      } else {
        result.arguments.push(arg);
      }

      i++;
    }

    return result;
  }

  getDefaultOptions(command: CliCommand) {
    const defaultOptions: any = {};
    const optionNames = Object.keys(command.options ?? {});
    for (const optionName of optionNames) {
      const option = (command.options ?? {})[optionName];
      if (Object.keys(option).includes("default")) {
        defaultOptions[optionName] = option.default;
      }
    }
    return defaultOptions;
  }

  getCommand(commandName: string) {
    const command = this.options.commands[commandName];
    if (command == null) {
      this.logger.error(`Unknown command ${commandName}\n\n${this.help(false)}.`);
      process.exit(1);
    }
    return command;
  }

  getOptionNameByShortName(optionShortName: string, command: CliCommand) {
    const optionNames = Object.keys(command.options ?? {});
    for (const optionName of optionNames) {
      if ((command.options ?? {})[optionName].short === optionShortName) return optionName;
    }
    return null;
  }

  help(showDescription = true) {
    let output = ``;
    if (showDescription && this.options.description != null) {
      output += this.options.description;
      output += "\n\n";
    }

    output += "Commands:\n\n";

    const commandNames = Object.keys(this.options.commands);
    for (let i = 0; i < commandNames.length; i++) {
      if (i > 0) output += "\n\n";
      const commandName = commandNames[i];
      const command = this.options.commands[commandName];
      output += `${this.options.executableName} ${commandName}\n  ${command.description}`;

      if (command.options != null && Object.keys(command.options).length > 0) {
        output += "\n\n";
        const optionNames = Object.keys(command.options);

        const longestOptionNameLength = optionNames.reduce((l, n) => (n.length > l ? n.length : l), 0);

        for (let j = 0; j < optionNames.length; j++) {
          const optionName = optionNames[j];
          if (j > 0) output += "\n";
          const option = command.options[optionName];
          if (option.short != null) output += `  -${option.short}, `;
          else output += "      ";
          output += `--${optionName}`;
          output += " ".repeat(longestOptionNameLength - optionName.length + 4);
          output += `${option.description}`;

          let comment = [];
          if (option.type != null) comment.push(`type: ${option.type}`);
          if (option.oneOf != null) comment.push(`values: ${option.oneOf.join(", ")}`);
          if (Object.keys(option).includes("default")) comment.push(`default: ${option.default}`);
          if (comment.length > 0) output += ` [${comment.join("; ")}]`;

          if (option.type === "flag") {
            output += `\n      --no-${optionName}`;
          }
        }
      }
    }
    return output;
  }
}
