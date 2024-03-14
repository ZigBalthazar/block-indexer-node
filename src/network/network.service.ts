import { ETH, Peer, DPT, RLPx, DISCONNECT_REASON } from "@ethereumjs/devp2p";
import Config from "../config/config.service";
import { Handler } from "../handler/handler.service";

export class Network {
  private dpt: DPT;
  private rlpx: RLPx;
  constructor(private readonly config: Config, private readonly handler: Handler) {
    this.dpt = new DPT(config.privateKey, {
      refreshInterval: 30000,
      endpoint: {
        address: "0.0.0.0",
        udpPort: null,
        tcpPort: null,
      },
    });

    this.rlpx = new RLPx(config.privateKey, {
      dpt: this.dpt,
      maxPeers: 25,
      capabilities: [ETH.eth66, ETH.eth68],
      common: config.common,
      remoteClientIdFilter: config.REMOTE_CLIENT_ID_FILTER,
    });

    this.start();

    for (const bootnode of config.bootnodes) {
      this.dpt.bootstrap(bootnode).catch((err) => {
        console.error(`DPT bootstrap error: ${err.stack ?? err}`);
      });
    }
    this.monitorPeers();
  }

  private start() {
    this.dptErrorEvent();
    this.rlpxErrorEvent();
    this.rlpxPeerAddedEvent();
    this.rlpxPeerRemovedEvent();
    this.rlpxPeerErrorEvent();
    this.ethMessageEvent();
  }

  private ethMessageEvent() {}
  private rlpxPeerAddedEvent() {
    this.ethMessageEvent();
  }

  private dptErrorEvent() {
    this.dpt.events.on("error", (err) => this.handler.dptErrorEvent(err));
  }

  private rlpxErrorEvent() {
    this.rlpx.events.on("error", (err) => this.handler.rlpxErrorEvent(err));
  }

  private rlpxPeerRemovedEvent() {
    this.rlpx.events.on("peer:removed", (peer: Peer, reasonCode: DISCONNECT_REASON, disconnectWe: boolean) => this.handler.rlpxPeerRemoved(this.rlpx, peer, reasonCode, disconnectWe));
  }

  private rlpxPeerErrorEvent() {
    this.rlpx.events.on("peer:error", (peer: Peer, err) => this.handler.rlpxPeerErrorEvent(this.dpt, peer, err));
  }

  private monitorPeers() {
    setInterval(() => {
      const peersCount = this.dpt.getPeers().length;
      const openSlots = this.rlpx._getOpenSlots();

      // @ts-ignore
      const queueLength = rlpx._peersQueue.length;

      // @ts-ignore
      const queueLength2 = rlpx._peersQueue.filter((o) => o.ts <= Date.now()).length;

      console.log(`Total nodes in DPT: ${peersCount}, open slots: ${openSlots}, queue: ${queueLength} / ${queueLength2}`);
    }, 30000);
  }
}
