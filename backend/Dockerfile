# ── Build stage ────────────────────────────────────────────────────────────
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o server ./cmd/server/main.go

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM alpine:3.19

# Go runtime needs to be present so the server can spawn `go run` child processes
RUN apk add --no-cache go git

WORKDIR /app
COPY --from=builder /app/server .

# Create data directory for JSON stores
RUN mkdir -p /data

# Copy seed challenges so the platform starts with data
COPY data/challenges.json /data/challenges.json

EXPOSE 8080

ENV DATA_DIR=/data
CMD ["./server"]
