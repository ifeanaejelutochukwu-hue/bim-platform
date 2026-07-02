# ── Build stage ────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Cache dependencies separately — only re-downloads when go.mod changes
COPY go.mod go.sum ./
RUN go mod download

# Build the server binary
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o server ./cmd/server/main.go

# ── Runtime stage ───────────────────────────────────────────────────────────
# We keep the full Go toolchain because the server spawns `go run` to compile
# and execute student code in sandboxed temp directories.
FROM golang:1.23-alpine

RUN apk add --no-cache git

WORKDIR /app

# Copy the compiled binary from the build stage
COPY --from=builder /app/server .

# Copy seed challenges so the platform has questions on first boot
RUN mkdir -p /data
COPY data/challenges.json /data/challenges.json

EXPOSE 8080

ENV DATA_DIR=/data

CMD ["./server"]
