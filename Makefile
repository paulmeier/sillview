# Sillview developer Makefile — thin, convenient wrappers around the npm scripts
# and git so you can build, run, test, and review locally with one-word commands.
# Run `make` (or `make help`) to list everything.

SHELL := /bin/bash
.DEFAULT_GOAL := help

KASAS_REPO := paulmeier/kasas
KASAS_BIN  := resources/bin/kasas

# --------------------------------------------------------------------------- #
# Help                                                                         #
# --------------------------------------------------------------------------- #

.PHONY: help
help: ## Show this help
	@echo "Sillview — make targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*## "}{printf "  \033[36m%-13s\033[0m %s\n", $$1, $$2}'

# --------------------------------------------------------------------------- #
# Setup                                                                        #
# --------------------------------------------------------------------------- #

.PHONY: install
install: ## Install npm dependencies
	npm install

# Auto-install whenever a target needs deps but node_modules is missing/stale.
node_modules: package-lock.json
	npm install
	@touch node_modules

# --------------------------------------------------------------------------- #
# Run                                                                          #
# --------------------------------------------------------------------------- #

.PHONY: dev
dev: node_modules ## Run the app against a real (bundled/managed) kasas backend
	npm start

.PHONY: mock
mock: node_modules ## Run the app on offline fixtures — no backend, no real data
	npm run start:mock

# --------------------------------------------------------------------------- #
# kasas backend binary (bundled into packaged builds)                          #
# --------------------------------------------------------------------------- #

.PHONY: kasas
kasas: $(KASAS_BIN) ## Download the prebuilt kasas binary into resources/bin (macOS)

# Fetch + checksum-verify the matching kasas release asset — same source CI uses.
$(KASAS_BIN):
	@command -v gh >/dev/null || { echo "✘ Needs the GitHub CLI (gh). Install it, or run 'make sync-kasas' to build from ../kasas."; exit 1; }
	@echo "▸ Resolving latest $(KASAS_REPO) release…"
	@v=$$(gh release view --repo $(KASAS_REPO) --json tagName -q .tagName); \
	  case "$$(uname -m)" in \
	    arm64)  a=arm64 ;; \
	    x86_64) a=amd64 ;; \
	    *) echo "✘ Unsupported arch: $$(uname -m)"; exit 1 ;; \
	  esac; \
	  asset="kasas_$${v}_darwin_$${a}.tar.gz"; \
	  echo "▸ Downloading $${asset}…"; \
	  tmp=$$(mktemp -d); \
	  gh release download "$${v}" --repo $(KASAS_REPO) --pattern "$${asset}" --pattern "$${asset}.sha256" --dir "$$tmp"; \
	  ( cd "$$tmp" && shasum -a 256 -c "$${asset}.sha256" ); \
	  tar -C "$$tmp" -xzf "$$tmp/$${asset}"; \
	  mkdir -p $(dir $(KASAS_BIN)); \
	  cp "$$tmp/kasas_$${v}_darwin_$${a}/kasas" $(KASAS_BIN); \
	  chmod +x $(KASAS_BIN); \
	  rm -rf "$$tmp"; \
	  echo "✔ kasas $${v} ($${a}) → $(KASAS_BIN)"

.PHONY: sync-kasas
sync-kasas: ## Build the kasas binary from ../kasas source (needs Go + the repo)
	npm run sync:kasas

# --------------------------------------------------------------------------- #
# Quality gates                                                                #
# --------------------------------------------------------------------------- #

.PHONY: lint
lint: node_modules ## Run ESLint
	npm run lint

.PHONY: lint-fix
lint-fix: node_modules ## Run ESLint with --fix
	npx eslint --ext .ts,.tsx . --fix

.PHONY: typecheck
typecheck: node_modules ## Type-check with tsc (no emit)
	npm run typecheck

.PHONY: test
test: lint typecheck ## Run all local checks (lint + typecheck) — mirrors CI

.PHONY: review
review: test ## Pre-PR: run checks, then summarize the diff vs origin/main
	@echo ""
	@git fetch -q origin main || true
	@echo "── diff vs origin/main ─────────────────────────────"
	@git --no-pager diff --stat origin/main...HEAD || true
	@echo ""
	@echo "Tip: in Claude Code, run /code-review and /security-review for an AI pass."

# --------------------------------------------------------------------------- #
# Build                                                                        #
# --------------------------------------------------------------------------- #

.PHONY: package
package: node_modules $(KASAS_BIN) ## Build the unpackaged .app into out/
	npm run package

.PHONY: dist
dist: node_modules $(KASAS_BIN) ## Build distributables — .dmg + .zip into out/make/
	npm run make

.PHONY: build
build: dist ## Alias for `dist` (the downloadable app)

# --------------------------------------------------------------------------- #
# Release                                                                       #
#                                                                               #
# Releases are automated by release-please from Conventional Commit history: it #
# keeps a "release" PR open that bumps the version + CHANGELOG; merging it tags  #
# the release, and CI builds + attaches the .dmg/.zip. There is no manual        #
# release target — just land Conventional Commits on main. See CONTRIBUTING.md.  #
# --------------------------------------------------------------------------- #

# --------------------------------------------------------------------------- #
# Clean                                                                        #
# --------------------------------------------------------------------------- #

.PHONY: clean
clean: ## Remove build output (out/, .vite/)
	rm -rf out .vite

.PHONY: clean-all
clean-all: clean ## clean + remove node_modules and the bundled kasas binary
	rm -rf node_modules $(KASAS_BIN)
