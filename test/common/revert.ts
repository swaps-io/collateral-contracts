import { expect } from 'chai';

type CustomStringRevertParam = { customString: string };
type ReasonStringRevertParam = { reasonString: string };
type CustomErrorRevertParam = { customError: string };
type RevertParam = CustomStringRevertParam | ReasonStringRevertParam | CustomErrorRevertParam;

type RevertOptions = {
  allowFail?: boolean, // Useful for printing stacktrace when unexpected revert reason occur
};

export const expectRevert = async <T>(promise: Promise<T>, param: RevertParam, options: RevertOptions = {}) => {
  let revertRegex: RegExp;
  if ('customString' in param) {
    revertRegex = stringRegex(param.customString);
  }
  if ('reasonString' in param) {
    revertRegex = reasonStringRegex(param.reasonString);
  }
  if ('customError' in param) {
    revertRegex = customErrorRegex(param.customError);
  }

  if (options.allowFail) {
    await promise;
    expect(true).to.be.equal(false, 'Expected promise to revert with fail allowed, but it resolved successfully');
  }

  try {
    await expect(promise).to.be.eventually.rejectedWith(revertRegex!);
  } catch (e) {
    console.log('--- Revert reason error ---');
    console.log(param);
    console.log(e);
    console.log('---');
    throw e;
  }
};

const stringRegex = (string: string): RegExp => {
  return new RegExp(string, 'g');
};

const reasonStringRegex = (reasonString: string): RegExp => {
  return stringRegex(`reverted with reason string ${quoted(reasonString)}`);
};

const customErrorRegex = (customError: string): RegExp => {
  return stringRegex(`reverted with custom error ${quoted(escaped(customError))}`);
};

const quoted = (value: string): string => {
  return `\\'${value}\\'`;
};

const escaped = (value: string): string => {
  return value
    .replace('(', '\\(')
    .replace(')', '\\)');
};
