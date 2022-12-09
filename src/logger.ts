import colors from "colors/safe";
import { DateTime } from "luxon";

import { Config } from "./config";

export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
}

function logLevelToInt(level: LogLevel) {
  switch (level) {
    case LogLevel.Debug:
      return 0;
    case LogLevel.Info:
      return 1;
    case LogLevel.Warn:
      return 2;
    case LogLevel.Error:
      return 3;
  }

  return -1;
}

export class Logger {
  protected readonly level: LogLevel = LogLevel.Info;

  constructor(protected config: Config) {
    if (
      config.logLevel != null &&
      logLevelToInt(<LogLevel>config.logLevel) != -1
    ) {
      this.level = <LogLevel>config.logLevel;
    }
  }

  async log(level: LogLevel, message: string) {
    if (logLevelToInt(level) < logLevelToInt(this.level)) return;

    const now = DateTime.now().toFormat("HH:mm:ss");

    switch (level) {
      case LogLevel.Debug:
        console.log(colors.bold(colors.grey(`[DEBUG] ${now}`)), message);
        break;
      case LogLevel.Info:
        console.log(colors.bold(colors.blue(`[INFO] ${now}`)), message);
        break;
      case LogLevel.Warn:
        console.log(colors.bold(colors.yellow(`[WARN] ${now}`)), message);
        break;
      case LogLevel.Error:
        console.error(colors.bold(colors.red(`[ERROR] ${now}`)), message);
        break;
    }
  }

  async debug(message: string) {
    await this.log(LogLevel.Debug, message);
  }

  async info(message: string) {
    await this.log(LogLevel.Info, message);
  }

  async warn(message: string) {
    await this.log(LogLevel.Warn, message);
  }

  async error(message: string) {
    await this.log(LogLevel.Error, message);
  }
}
