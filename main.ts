import * as dotenv from "dotenv/mod.ts";
import { Bot } from "./src/Bot.ts";
import { Markov } from "./src/Markov.ts";
import { MiClient } from "./src/MiClient.ts";

await dotenv.load({
  export: true,
  examplePath: ".env-example",
  envPath: ".env",
});

const parseBool = (s: string) => s == "true";

const client = new MiClient(
  Deno.env.get("HOST")!,
  Deno.env.get("TOKEN")!,
  Deno.env.get("IS_SSL") == null ? true : parseBool(Deno.env.get("IS_SSL")!),
);

try {
  await Deno.mkdir(".db");
} catch {}
const markov = new Markov(
  await Deno.openKv(".db/markov"),
  +Deno.env.get("MAX_WORDS")!
);
const bot = new Bot(client.createStream(), client, markov);

await bot.start();
