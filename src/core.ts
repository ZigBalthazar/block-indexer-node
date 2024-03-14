import { Common } from "@ethereumjs/common";
import Config from "./config/config.service";
import { Network } from "./network/network.service";
import { Handler } from "./handler/handler.service";

export class Core {
  private readonly config: Config;
  private readonly network: Network;
  private readonly handler: Handler;
  private readonly common: Common = new Common({ chain: this.chainId });

  constructor(private readonly chainId: string, privateKey: Uint8Array) {
    this.config = new Config(this.common, privateKey);
    this.handler = new Handler();
    this.network = new Network(this.config, this.handler);
  }

  bootstrap() {}
}
