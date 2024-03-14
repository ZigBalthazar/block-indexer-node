// private ethMessageEvent() {}
// private rlpxPeerAddedEvent()

import { DISCONNECT_REASON, DPT, Peer, RLPx } from "@ethereumjs/devp2p";
import { getPeerAddr } from "../utils/utils";
import { Block } from "@ethereumjs/block";
import { bytesToUnprefixedHex } from "@ethereumjs/util";
import { LRUCache } from "lru-cache";
import { TypedTransaction } from "@ethereumjs/tx";

export class Handler {
  private blocksCache: LRUCache<string, boolean> = new LRUCache({ max: 100 });
  private txCache: LRUCache<string, boolean> = new LRUCache({ max: 1000 });

  rlpxPeerRemoved(rlpx: RLPx, peer: Peer, reasonCode: DISCONNECT_REASON, disconnectWe: boolean) {
    const who = disconnectWe === true ? "we disconnect" : "peer disconnect";
    const total = rlpx.getPeers().length;
    console.log(`Remove peer: ${getPeerAddr(peer)} - ${who}, reason: ${peer.getDisconnectPrefix(reasonCode)} (${String(reasonCode)}) (total: ${total})`);
  }

  rlpxPeerErrorEvent(dpt: DPT, peer: Peer, err) {
    if (err.code === "ECONNRESET") return;

    if (err instanceof Error) {
      const peerId = peer.getId();
      if (peerId !== null) dpt.banPeer(peerId, 5 * 60 * 1000);

      console.error(`Peer error (${getPeerAddr(peer)}): ${err.message}`);
      return;
    }

    console.error(`Peer error (${getPeerAddr(peer)}): ${err.stack ?? err}`);
  }

  rlpxErrorEvent(err) {
    console.error(`RLPx error: ${err.stack ?? err}`);
  }

  dptErrorEvent(err) {
    console.error("DPT error:", err);
  }

  onNewBlock(block: Block) {
    const blockHashHex = bytesToUnprefixedHex(block.hash());
    const blockNumber = block.header.number;
    if (this.blocksCache.has(blockHashHex)) return;
    console.log("New Block:", blockNumber);
    this.blocksCache.set(blockHashHex, true);
    for (const tx of block.transactions) this.onNewTx(tx);
  }

  private onNewTx(tx: TypedTransaction) {
    const txHashHex = bytesToUnprefixedHex(tx.hash());
    if (this.txCache.has(txHashHex)) return;

    this.txCache.set(txHashHex, true);
    console.log("-".repeat(20));
    console.log(`New tx: ${txHashHex}`);
    console.log(`tx from: ${tx.getSenderAddress()}`);
    console.log(`tx to: ${tx.to}`);
  }
}
