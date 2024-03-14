import { Common } from "@ethereumjs/common";
import Config from "./config/config.service";
import { Network } from "./network/network.service";
import { Handler } from "./handler/handler.service";
import { Queue } from "./queue/queue.service";

export class Core {
  private readonly config: Config;
  private readonly network: Network;
  private readonly handler: Handler;
  private readonly common: Common;
  private readonly queue: Queue;

  constructor(private readonly chainId: number, private readonly hf: string, privateKey: Uint8Array) {
    this.common = new Common({ chain: this.chainId, hardfork: this.hf });
    this.config = new Config(this.common, privateKey);
    this.queue = new Queue();
    this.handler = new Handler(this.config,this.queue);
    this.network = new Network(this.config, this.handler);
  }
}
