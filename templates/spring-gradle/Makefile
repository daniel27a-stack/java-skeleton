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

run: ## Start the service with the local profile
	./gradlew bootRun --args=--spring.profiles.active=local

run-cert: ## Start the service with the cert profile
	./gradlew bootRun --args=--spring.profiles.active=cert

run-prod: ## Start the service with the prod profile (asks for confirmation)
	@printf 'Start the service with the PROD profile? [y/N] '; read answer; \
	case "$$answer" in y|Y|yes|YES|Yes) ;; *) echo 'Aborted.'; exit 0;; esac; \
	./gradlew bootRun --args=--spring.profiles.active=prod

.PHONY: help test int arch build me-happy run run-cert run-prod
