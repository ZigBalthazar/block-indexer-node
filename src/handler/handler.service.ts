// private ethMessageEvent() {}
// private rlpxPeerAddedEvent()

import { DISCONNECT_REASON, DPT, ETH, Peer, RLPx } from "@ethereumjs/devp2p";
import { getPeerAddr, isValidBlock } from "../utils/utils";
import { Block, BlockHeader } from "@ethereumjs/block";
import { bytesToUnprefixedHex, equalsBytes, intToBytes } from "@ethereumjs/util";
import { LRUCache } from "lru-cache";
import { TypedTransaction, TransactionFactory } from "@ethereumjs/tx";
import Config from "../config/config.service";
import { Queue } from "../queue/queue.service";

export class Handler {
  private blocksCache: LRUCache<string, boolean> = new LRUCache({ max: 100 });
  private txCache: LRUCache<string, boolean> = new LRUCache({ max: 1000 });

  constructor(private readonly config: Config, private queue:Queue) {}

  rlpxPeerAddedEvent(rlpx: RLPx, peer) {
    const addr = getPeerAddr(peer);
    const eth = peer.getProtocols()[0];
    const clientId = peer.getHelloMessage()?.clientId;
    const requests: {
      headers: any[]
      bodies: any[]
      msgTypes: { [key: string]: ETH.MESSAGE_CODES }
    } = { headers: [], bodies: [], msgTypes: {} }
    console.log(`Add peer: ${addr} ${clientId} (eth${eth.getVersion()}) (total: ${rlpx.getPeers().length})`);

    eth.sendStatus({
      td: this.config.TOTAL_DIFFICULTY,
      bestHash: this.config.BEST_HASH,
      genesisHash: this.config.GENESIS_HASH,
    });

    // check CHECK_BLOCK
    //TODO: extract function
    let forkDrop: NodeJS.Timeout;
    let forkVerified = false;
    eth.events.once("status", () => {
      eth.sendMessage(ETH.MESSAGE_CODES.GET_BLOCK_HEADERS, [Uint8Array.from([1]), [intToBytes(this.config.CHECK_BLOCK_NR), Uint8Array.from([1]), Uint8Array.from([]), Uint8Array.from([])]]);
      forkDrop = setTimeout(() => {
        peer.disconnect(DISCONNECT_REASON.USELESS_PEER);
      }, 15000);
      peer.events.once("close", () => clearTimeout(forkDrop));
    });

    eth.events.on("message", async (code: ETH.MESSAGE_CODES, payload) => {
      // We keep track of how many of each message type are received
      if (code in requests.msgTypes) {
        requests.msgTypes[code]++
      } else {
        requests.msgTypes[code] = 1
      }
  
      switch (code) {
        case ETH.MESSAGE_CODES.NEW_BLOCK_HASHES:
          if (!forkVerified) break
  
          for (const item of payload) {
            const blockHash = item[0]
            if (this.blocksCache.has(bytesToUnprefixedHex(blockHash))) continue
            setTimeout(() => {
              eth.sendMessage(ETH.MESSAGE_CODES.GET_BLOCK_HEADERS, [
                Uint8Array.from([2]),
                [blockHash, Uint8Array.from([1]), Uint8Array.from([]), Uint8Array.from([])],
              ])
              requests.headers.push(blockHash)
            }, 100)
          }
          break
  
        case ETH.MESSAGE_CODES.TX:
          if (!forkVerified) break
  
          for (const item of payload) {
            const tx = TransactionFactory.fromBlockBodyData(item)
            if (tx.isValid()) this.onNewTx(tx)
          }
  
          break
  
        case ETH.MESSAGE_CODES.GET_BLOCK_HEADERS: {
          const headers = []
          // hack
          const blockNrBytes = intToBytes(this.config.CHECK_BLOCK_NR);
          const payloadBytes = Array.from(payload[1][0]);
          
          if (blockNrBytes.every((value, index) => value === payloadBytes[index])) {
            headers.push(this.config.CHECK_BLOCK_HEADER);
          }
  
          if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
            peer.disconnect(DISCONNECT_REASON.USELESS_PEER)
          } else {
            eth.sendMessage(ETH.MESSAGE_CODES.BLOCK_HEADERS, [payload[0], headers])
          }
          break
        }
  
        case ETH.MESSAGE_CODES.BLOCK_HEADERS: {
          if (!forkVerified) {
            if (payload[1].length !== 1) {
              console.log(
                `${addr} expected one header for  verify (received: ${payload[1].length})`
              )
              peer.disconnect(DISCONNECT_REASON.USELESS_PEER)
              break
            }
  
            const expectedHash = this.config.CHECK_BLOCK
            const header = BlockHeader.fromValuesArray(payload[1][0], { common:this.config.common })
            if (bytesToUnprefixedHex(header.hash()) === expectedHash) {
              console.log(`${addr} verified to be on the same side`)
              clearTimeout(forkDrop)
              forkVerified = true
            }
          } else {
            if (payload[1].length > 1) {
              console.log(
                `${addr} not more than one block header expected (received: ${payload[1].length})`
              )
              break
            }
  
            let isValidPayload = false
            const header = BlockHeader.fromValuesArray(payload[1][0], { common:this.config.common })
            while (requests.headers.length > 0) {
              const blockHash = requests.headers.shift()
              if (equalsBytes(header.hash(), blockHash)) {
                isValidPayload = true
                setTimeout(() => {
                  eth.sendMessage(ETH.MESSAGE_CODES.GET_BLOCK_BODIES, [
                    Uint8Array.from([3]),
                    [blockHash],
                  ])
                  requests.bodies.push(header)
                }, 100)
                break
              }
            }
  
            if (!isValidPayload) {
              console.log(
                `${addr} received wrong block header ${bytesToUnprefixedHex(header.hash())}`
              )
            }
          }
  
          break
        }
  
        case ETH.MESSAGE_CODES.GET_BLOCK_BODIES:
          if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
            peer.disconnect(DISCONNECT_REASON.USELESS_PEER)
          } else {
            eth.sendMessage(ETH.MESSAGE_CODES.BLOCK_BODIES, [payload[0], []])
          }
          break
  
        case ETH.MESSAGE_CODES.BLOCK_BODIES: {
          if (!forkVerified) break
  
          if (payload[1].length !== 1) {
            console.log(
              `${addr} not more than one block body expected (received: ${payload[1].length})`
            )
            break
          }
  
          let isValidPayload = false
          while (requests.bodies.length > 0) {
            const header = requests.bodies.shift()
            const txs = payload[1][0][0]
            const uncleHeaders = payload[1][0][1]
            const block = Block.fromValuesArray([header.raw(), txs, uncleHeaders], { common:this.config.common })
            const isValid = await isValidBlock(block)
            if (isValid) {
              isValidPayload = true
              this.onNewBlock(block)
              break
            }
          }
  
          if (!isValidPayload) {
            console.log(`${addr} received wrong block body`)
          }
  
          break
        }
  
        case ETH.MESSAGE_CODES.NEW_BLOCK: {
          if (!forkVerified) break
  
          const newBlock = Block.fromValuesArray(payload[0], { common:this.config.common })
          const isValidNewBlock = await isValidBlock(newBlock)
          if (isValidNewBlock) this.onNewBlock(newBlock)
  
          break
        }
  
        case ETH.MESSAGE_CODES.GET_NODE_DATA:
          if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
            peer.disconnect(DISCONNECT_REASON.USELESS_PEER)
          } else {
            eth.sendMessage(ETH.MESSAGE_CODES.NODE_DATA, [payload[0], []])
          }
          break
  
        case ETH.MESSAGE_CODES.NODE_DATA:
          break
  
        case ETH.MESSAGE_CODES.GET_RECEIPTS:
          if (requests.headers.length === 0 && requests.msgTypes[code] >= 8) {
            peer.disconnect(DISCONNECT_REASON.USELESS_PEER)
          } else {
            eth.sendMessage(ETH.MESSAGE_CODES.RECEIPTS, [payload[0], []])
          }
          break
  
        case ETH.MESSAGE_CODES.RECEIPTS:
          break
      }
    });
  }

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
    
  }

  private onNewBlock(block: Block) {
    const blockHashHex = bytesToUnprefixedHex(block.hash());
    if (this.blocksCache.has(blockHashHex)) return;
    const blockNumber = block.header.number;
    console.log("New Block:", blockNumber);
    this.blocksCache.set(blockHashHex, true);
    for (const tx of block.transactions) this.onNewTx(tx);
  }

  private onNewTx(tx: TypedTransaction) {
    const txHashHex = bytesToUnprefixedHex(tx.hash());
    if (this.txCache.has(txHashHex)) return;
    this.queue.sendToQueue(tx)
    this.txCache.set(txHashHex, true);
  }
}
