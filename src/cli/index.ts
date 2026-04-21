#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init";
import { generateKeysOutput } from "./commands/keys";

const program = new Command();
program.name("next-push").description("Web Push tools for Next.js").version("0.1.0");

program
  .command("keys:generate")
  .description("Generate a new VAPID key pair")
  .option("-s, --subject <subject>", "mailto: or URL for the VAPID subject")
  .action(async (opts: { subject?: string }) => {
    const lines = await generateKeysOutput(opts.subject);
    for (const l of lines) console.log(l);
  });

program
  .command("init")
  .description("Scaffold next-push into a Next.js project")
  .option("--send-only", "only generate server-side files")
  .option("--receive-only", "only generate client/SW files")
  .option("--force", "overwrite existing files")
  .option("--sw-addon", "generate public/next-push-sw.js and show importScripts recipe")
  .option("--skip-sw", "skip service worker file generation")
  .option("--default-icon <path>", "path to default notification icon (e.g., /icons/icon-192.png)")
  .option(
    "--default-badge <path>",
    "path to default notification badge (e.g., /icons/badge-72.png)",
  )
  .action(
    async (opts: {
      sendOnly?: boolean;
      receiveOnly?: boolean;
      force?: boolean;
      swAddon?: boolean;
      skipSw?: boolean;
      defaultIcon?: string;
      defaultBadge?: string;
    }) => {
      await runInit(opts);
    },
  );

program.parseAsync();
