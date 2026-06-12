# Architecture Decision Records

This is Sillview's **decision log**. Each Architecture Decision Record (ADR)
captures one significant, hard-to-reverse choice: the context that forced it, the
options weighed, the decision taken, and the consequences accepted. ADRs are
immutable once accepted — we don't edit a decision, we supersede it with a new one.

The format is a light [MADR](https://adr.github.io/madr/) variant. Every record
follows the same skeleton so reviewers know where to look:

| Section | Purpose |
| --- | --- |
| **Status** | `Proposed` · `Accepted` · `Superseded by …` · `Deprecated`. |
| **Context and problem statement** | What forced a decision, in this codebase's terms. |
| **Decision drivers** | The constraints and goals the option must satisfy. |
| **Considered options** | The real alternatives, each with pros and cons. |
| **Decision outcome** | The chosen option and why. |
| **Detailed design** | Enough specificity to review and implement against. |
| **Consequences** | What gets better, what gets worse, and the residual risks. |
| **Implementation plan** | A phased, checkable rollout. |
| **Open questions** | What still has to be decided, and by whom. |

## The log

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-user-created-widgets-tiered-model.md) | User-created widgets: a declarative-first, tiered model | Proposed |
| [0002](0002-backend-capability-detection-and-plugin-activation.md) | Backend-gated widgets: capability detection and plugin activation | Proposed |
| [0003](0003-third-party-code-widget-sandboxing.md) | Third-party code widgets: the sandbox and trust model | Proposed (deferred) |
| [0004](0004-external-market-data-ownership-and-storage.md) | External market data: ownership, storage, and access | Proposed |

## Reading order

ADR-0001 is the spine: it defines the **altitude ladder** for letting users build
widgets and commits to staying declarative as long as possible. ADR-0002 is
orthogonal — it covers widgets that depend on a backend *plugin or capability*,
regardless of which tier built them. ADR-0003 is the deliberately deferred, security-
heavy decision about ever running **third-party code** (the ladder's top rung); it
exists so the trade space is written down before anyone is tempted to ship it.
ADR-0004 answers a different question — where **external market/reference data**
(benchmarks, quotes, FX) lives and who ingests it — and narrows ADR-0002's
"kind (b)" external-egress escape hatch in the process; it ends with the queue of
follow-up decisions (provider choice, balance snapshots, comparison methodology,
valuation) it deliberately leaves open.

## Writing a new ADR

1. Copy the skeleton above into `NNNN-short-slug.md` (next free 4-digit number).
2. Start at `Status: Proposed`; fill every section.
3. Add a row to the table above and a nav entry in `mkdocs.yml`.
4. On merge of the implementing change, flip the status to `Accepted` (or link the
   ADR that supersedes it). Keep superseded ADRs in place — the history is the point.
