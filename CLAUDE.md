# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GraphQL subgraph for The Graph protocol that indexes all ERC20-compliant tokens, tracking balances and approvals across the blockchain. The subgraph monitors Transfer and Approval events from ERC20 contracts and creates a queryable GraphQL API.

## Core Commands

- **Generate TypeScript types**: `npm run codegen` - Run after modifying schema.graphql
- **Build subgraph**: `npm run build` - Compile the subgraph for deployment
- **Deploy to main Graph node**: `npm run deploy`
- **Deploy to remote node**: `npm run deploy-remote`
- **Create subgraph on remote**: `npm run create-remote`

## Architecture

The subgraph consists of:

1. **Schema (schema.graphql)**: Defines 4 entities - Token, Account, TokenBalance, TokenApproval with relationships
2. **Mapping (src/mapping.ts)**: Event handlers that process Transfer/Approval events and update entities
3. **Configuration (subgraph.yaml)**: Defines data sources, network (camp-testnet), and event mappings
4. **ABI (abis/ERC20.json)**: ERC20 contract interface for type generation

## Key Implementation Details

- Uses composite IDs for relationships (e.g., `token.id + "-" + account.id` for TokenBalance)
- Handles zero address (0x0) specially in transfers to avoid creating balances for mint/burn operations
- Validates token contracts by checking if ERC20 methods (name, symbol, decimals, totalSupply) are callable
- Prevents overflow by rejecting tokens with decimals > 255
- Updates token totalSupply on every Transfer event
- Uses try/catch pattern for contract calls to handle non-compliant tokens gracefully

## Development Workflow

1. Modify schema.graphql → run `npm run codegen` to regenerate types
2. Update mapping.ts handlers → run `npm run build` to validate
3. Test changes → deploy to testnet with `npm run deploy-remote`
4. Production deployment → use `npm run deploy`

The subgraph is currently configured for camp-testnet network and indexes from block 0.