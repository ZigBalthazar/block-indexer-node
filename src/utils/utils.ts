import { Block } from "@ethereumjs/block";
import { Peer } from "@ethereumjs/devp2p";

// @ts-ignore
export const getPeerAddr = (peer: Peer) => `${peer._socket.remoteAddress}:${peer._socket.remotePort}`;
export async function isValidBlock(block: Block) {
    return (
      block.uncleHashIsValid() &&
      block.transactions.every(({ isValid }) => isValid()) &&
      block.transactionsTrieIsValid()
    )
  }