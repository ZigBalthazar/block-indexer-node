import { Common } from "@ethereumjs/common";
import { RLP } from "@ethereumjs/rlp";
import { intToBytes, hexToBytes } from "@ethereumjs/util";

export default class Config {
  public readonly REMOTE_CLIENT_ID_FILTER = ["go1.5", "go1.6", "go1.7", "quorum", "pirl", "ubiq", "gmc", "gwhale", "prichain"];
  public readonly CHECK_BLOCK_NR = 12244000;
  public readonly CHECK_BLOCK = "1638380ab737e0e916bd1c7f23bd2bab2a532e44b90047f045f262ee21c42b21";
  public readonly CHECK_BLOCK_HEADER = RLP.decode(
    "0xf90219a0d44a4d33e28d7ea9edd12b69bd32b394587eee498b0e2543ce2bad1877ffbeaca01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347941ad91ee08f21be3de0ba2ba6918e714da6b45836a0fdec060ee45e55da9e36060fc95dddd0bdc47e447224666a895d9f0dc9adaa0ca0092d9fcc02ca9b372daec726704ce720d3aa366739868f4820ecaabadb9ac309a0974fee017515a46303f467b6fd50872994db1b0ea64d3455bad93ff9678aced9b90100356050004c5c89691add79838a01d4c302419252a4d3c96e9273908b7ee84660886c070607b4928c416a1800746a0d1dbb442d0baf06eea321422263726748600cc200e82aec08336863514d12d665718016989189c116bc0947046cc6718110586c11464a189000a11a41cc96991970153d88840768170244197e164c6204249b9091a0052ac85088c8108a4418dd2903690a036722623888ea14e90458a390a305a2342cb02766094f68c4100036330719848b48411614686717ab6068a46318204232429dc42020608802ceecd66c3c33a3a1fc6e82522049470328a4a81ba07c6604228ba94f008476005087a6804463696b41002650c0fdf548448a90408717ca31b6d618e883bad42083be153b83bdfbb1846078104798307834383639373636353666366532303530366636663663a0ae1de0acd35a98e211c7e276ad7524bb84a5e1b8d33dd7d1c052b095b564e8b888cca66773148b6e12"
  );
  public common: Common;
  public readonly TOTAL_DIFFICULTY = intToBytes(17179869184);
  public readonly BEST_HASH = hexToBytes("0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3");
  public readonly GENESIS_HASH = hexToBytes("0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3");
  public readonly privateKey: Uint8Array;

  public bootnodes: {
    address: string;
    udpPort: number;
    tcpPort: number;
  }[];

  constructor(common: Common, privateKey: Uint8Array) {
    this.privateKey = privateKey;
    this.common = common;
    const bootstrapNodes = this.common.bootstrapNodes();
    this.bootnodes = bootstrapNodes.map((node: any) => {
      return {
        address: node.ip,
        udpPort: node.port,
        tcpPort: node.port,
      };
    });
  }
}
