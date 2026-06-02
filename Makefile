.PHONY: dev backend frontend build install clean

## dev: run backend and frontend together (Ctrl-C stops both)
dev:
	@echo "Starting backend (:5080) and frontend (:4200)..."
	@$(MAKE) -j2 backend frontend

## backend: run the .NET API on :5080
backend:
	cd backend && dotnet run

## frontend: run the Angular dev server on :4200
frontend:
	cd frontend && npm start

## install: restore both toolchains
install:
	cd backend && dotnet restore
	cd frontend && npm install

## build: build both projects (used in CI)
build:
	cd backend && dotnet build --configuration Release
	cd frontend && npm ci && npm run build

## clean: remove build artifacts and the demo database
clean:
	cd backend && rm -rf bin obj *.db *.db-shm *.db-wal
	cd frontend && rm -rf dist .angular
