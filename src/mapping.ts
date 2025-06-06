import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";

import { Approval, ERC20, Transfer } from "../generated/ERC20/ERC20";
import {
  Account,
  Token,
  TokenApproval,
  TokenBalance,
} from "../generated/schema";

const zeroAddress = '0x0000000000000000000000000000000000000000';

function loadOrCreateAccount(address: string): Account | null {
  let account = Account.load(address);
  if (!account) {
    account = new Account(address);
    account.save();
  }
  return account;
}

function loadOrCreateToken(event: ethereum.Event): Token | null {
  let token = Token.load(event.address.toHex());
  if (!token) {
    let erc20 = ERC20.bind(event.address);

    let nameResult = erc20.try_name();
    if (nameResult.reverted) {
      return null;
    }

    let symbolResult = erc20.try_symbol();
    if (symbolResult.reverted) {
      return null;
    }

    let decimalsResult = erc20.try_decimals();
    if (decimalsResult.reverted) {
      return null;
    }

    let totalSupplyResult = erc20.try_totalSupply();
    if (totalSupplyResult.reverted) {
      return null;
    }

    // Ignore any weird tokens to avoid overflowing the `decimals` field (which is an i32)
    // On mainnet for example there is at least one token which has a huge value for `decimals`
    // and that would overflow the Token entity's i32 field for the decimals
    if (decimalsResult.value.toBigDecimal().gt(BigDecimal.fromString("255"))) {
      return null;
    }

    token = new Token(event.address.toHex());
    token.name = nameResult.value;
    token.symbol = symbolResult.value;
    token.decimals = decimalsResult.value.toI32();
    token.totalSupply = totalSupplyResult.value;
    token.holdersCount = BigInt.fromI32(0);
    token.save();
  }
  return token;
}

export function handleApproval(event: Approval): void {
  let token = loadOrCreateToken(event);
  if (!token) {
    return;
  }

  let owner = event.params.owner.toHex();
  let spender = event.params.spender.toHex();
  let value = event.params.value.toBigDecimal();

  let ownerAccount = loadOrCreateAccount(owner);
  let spenderAccount = loadOrCreateAccount(spender);

  if (!ownerAccount || !spenderAccount) {
    return;
  }

  let tokenApproval = TokenApproval.load(
    token.id + "-" + ownerAccount.id + "-" + spenderAccount.id
  );
  if (!tokenApproval) {
    tokenApproval = new TokenApproval(
      token.id + "-" + ownerAccount.id + "-" + spenderAccount.id
    );
    tokenApproval.token = token.id;
    tokenApproval.ownerAccount = ownerAccount.id;
    tokenApproval.spenderAccount = spenderAccount.id;
  }
  tokenApproval.value = value;
  tokenApproval.save();
}

export function handleTransfer(event: Transfer): void {
  let token = loadOrCreateToken(event);
  if (!token) {
    return;
  }
  let erc20 = ERC20.bind(Address.fromString(token.id));
  let totalSupplyResult = erc20.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    token.totalSupply = totalSupplyResult.value;
    token.save();
  }

  let from = event.params.from.toHex();
  let to = event.params.to.toHex();
  let value = event.params.value.toBigDecimal();

  let fromAccount = loadOrCreateAccount(from);
  let toAccount = loadOrCreateAccount(to);

  if (!fromAccount || !toAccount) {
    return;
  }

  if (fromAccount.id != zeroAddress) {
    let fromTokenBalance = TokenBalance.load(token.id + "-" + fromAccount.id);
    if (!fromTokenBalance) {
      fromTokenBalance = new TokenBalance(token.id + "-" + fromAccount.id);
      fromTokenBalance.token = token.id;
      fromTokenBalance.account = fromAccount.id;
      fromTokenBalance.value = BigDecimal.fromString("0");
    }
    let oldFromValue = fromTokenBalance.value;
    fromTokenBalance.value = fromTokenBalance.value.minus(value);
    
    // Update holders count if balance goes to/from zero
    if (oldFromValue.gt(BigDecimal.fromString("0")) && fromTokenBalance.value.equals(BigDecimal.fromString("0"))) {
      token.holdersCount = token.holdersCount.minus(BigInt.fromI32(1));
    }
    
    fromTokenBalance.save();
  }

  if (toAccount.id != zeroAddress) {
    let toTokenBalance = TokenBalance.load(token.id + "-" + toAccount.id);
    if (!toTokenBalance) {
      toTokenBalance = new TokenBalance(token.id + "-" + toAccount.id);
      toTokenBalance.token = token.id;
      toTokenBalance.account = toAccount.id;
      toTokenBalance.value = BigDecimal.fromString("0");
    }
    let oldToValue = toTokenBalance.value;
    toTokenBalance.value = toTokenBalance.value.plus(value);
    
    // Update holders count if balance goes to/from zero
    if (oldToValue.equals(BigDecimal.fromString("0")) && toTokenBalance.value.gt(BigDecimal.fromString("0"))) {
      token.holdersCount = token.holdersCount.plus(BigInt.fromI32(1));
    }
    
    toTokenBalance.save();
  }
  
  // Save token with updated holdersCount
  token.save();
}
