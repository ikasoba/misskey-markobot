import * as dotenv from "dotenv/mod.ts";
import { Bot } from "./src/Bot.ts";
import { Markov } from "./src/Markov.ts";
import { MiClient } from "./src/MiClient.ts";

await dotenv.load({
  export: true,
  examplePath: ".env-example",
  envPath: ".env",
});

const client = new MiClient(Deno.env.get("HOST")!, Deno.env.get("TOKEN")!);
const markov = new Markov(await Deno.openKv("markov"));
const bot = new Bot(client.createStream(), client, markov);

await bot.start();