# MVP verification

Verified locally on macOS with Python 3.12 and Node.js 22.

## Automated checks

- Production build: TypeScript strict checking and Vite compilation.
- 14 pytest cases: catalog/tablet filtering, ranking/budget/OS invariants, no-match behavior, five invalid survey cases, malformed JSON, Chromebook opt-in conflict, price history consistency for every laptop, unknown-laptop 404, partial results with missing prices, stale-price warnings, options, and built frontend serving.
- npm dependency installation reported zero known vulnerabilities at setup time.

## Browser checks

- Visually compared the implementation with the Figma landing frame (`2-2`) and computing/software frame (`7-223`).
- Completed computing survey with a $1,300 Windows budget; three ranked recommendations returned from FastAPI.
- Saved a laptop, reloaded, and confirmed it remained in Saved.
- Compared Acer Aspire Go 16 and Dell XPS 13; recorded prices, scores, CPU, RAM, storage, OS, and historical lows were shown correctly, including estimated RAM.
- Set an Acer $600 target, reloaded, and confirmed it remained in the tracker; removed the temporary target afterward.
- Submitted a $1 budget and confirmed the no-matches state with a route to adjust preferences or browse the catalog.
- Verified the 390px mobile layout and mobile search (Dell returns one laptop).

## Limits

Retailer destinations were not purchased from or independently verified; they are the supplied CSV URLs. No live data collection, real notifications, cloud deployment, or authentication is implemented.
