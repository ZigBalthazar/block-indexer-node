import { randomBytes } from "@ethereumjs/util";
import { Chain, Hardfork } from "@ethereumjs/common";
import { Core } from "./src/core";

async function bootstrap() {
  const PRIVATE_KEY = randomBytes(32);
  new Core(Chain.Mainnet, Hardfork.Berlin, PRIVATE_KEY);
}

bootstrap()
  .then((result) => {})
  .catch((err) => {});
