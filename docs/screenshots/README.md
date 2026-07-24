# Screenshots (Level 1 submission)

| File | What it shows |
|---|---|
| `compile-output.png` | Terminal after `pnpm build:contract` compile succeeds and artifacts exist |
| `preprod-deploy.png` | Preprod deployment proof indexer GraphQL showing the contract on-chain |

> Submission tip: keep screenshots and short notes here in a consistent order so reviewers can quickly match each artifact to the deployment, test, or demo step it supports.

## Preprod deployment

- **Network:** Midnight Preprod
- **Contract address:** `0518e4dd6290efef2b8bca3edc38092ff3cbaa14d81575c93109bcb88c7f3acf`
- **Block:** 1,375,054
- **State:** `solvent=true`, `reserves=1,875,000,000`

### Indexer query

```graphql
# POST https://indexer.preprod.midnight.network/api/v4/graphql
query {
  contractAction(address: "0518e4dd6290efef2b8bca3edc38092ff3cbaa14d81575c93109bcb88c7f3acf") {
    __typename
    transaction { hash block { height timestamp } }
  }
}
```
