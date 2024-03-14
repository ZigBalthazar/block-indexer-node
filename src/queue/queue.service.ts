import { TypedTransaction } from "@ethereumjs/tx";
import { bytesToUnprefixedHex } from "@ethereumjs/util";

export class Queue{
    sendToQueue(tx:TypedTransaction){
        console.log(bytesToUnprefixedHex(tx.hash()));
    }
}