# Local shortcuts. They only call Gradle tasks; CI does not use this file.

.DEFAULT_GOAL := help

help: ## Show this help
	@awk -F ':.*## ' '/^[a-zA-Z_-]+:.*## /{printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

test: ## Run the unit tests
	./gradlew test

int: ## Run the integration tests
	./gradlew intTest

arch: ## Run the architecture tests
	./gradlew archTest

build: ## Build and verify (compile, all tests, checks)
	./gradlew build

me-happy: ## Clean build: the whole battery of validations and tests
	./gradlew clean build

publish: ## Publish the library to the configured Maven repository
	./gradlew publish

publish-local: ## Publish the library to the local Maven repository
	./gradlew publishToMavenLocal

.PHONY: help test int arch build me-happy publish publish-local
