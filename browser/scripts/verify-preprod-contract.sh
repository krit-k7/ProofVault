#!/usr/bin/env bash
# Query Midnight preprod indexer for a deployed PoR contract address.
# Usage: verify-preprod-contract.sh <contract-address-hex>
set -euo pipefail

ADDR="${1:-}"
if [[ -z "$ADDR" ]]; then
  echo "Usage: $0 <contract-address-hex>" >&2
  exit 1
fi

INDEXER="${POR_INDEXER_URL:-https://indexer.preprod.midnight.network/api/v4/graphql}"

QUERY='query ContractState($address: String!) {
  contractAction(address: $address) {
    __typename
    address
    state
    transaction {
      hash
      block { height timestamp }
    }
  }
}'

payload=$(jq -n --arg addr "$ADDR" --arg q "$QUERY" '{query: $q, variables: {address: $addr}}')

echo "Querying preprod indexer for contract ${ADDR}…"
echo

curl -sS -X POST "$INDEXER" \
  -H 'Content-Type: application/json' \
  -d "$payload" | jq .
