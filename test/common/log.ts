import { BaseContract, TransactionReceipt, TransactionResponse, Result } from 'ethers';
import { expect } from 'chai';

type ExpectLogParams = {
  contract: BaseContract;
  tx: TransactionResponse;
  receipt: TransactionReceipt;
  name: string;
  index?: number;
  check: (data: Result) => void;
}

export const expectLog = ({
  contract,
  tx,
  receipt,
  name,
  index = 0,
  check,
}: ExpectLogParams) => {
  expect(tx).to.emit(contract, name);

  const event = contract.interface.getEvent(name);
  expect(event).to.be.not.equal(null);
  const eventSignatureTopic = event!.topicHash;

  let foundLogIndex = 0;
  const eventLog = receipt.logs.find((log) => {
    if (log.topics[0] === eventSignatureTopic) {
      if (foundLogIndex === index) {
        return log;
      }
      foundLogIndex++;
    }
    return undefined;
  });
  expect(eventLog).to.be.not.equal(undefined);

  const data = contract.interface.decodeEventLog(name, eventLog!.data, eventLog!.topics);
  check(data);
};
