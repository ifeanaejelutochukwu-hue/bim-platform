# ── Build stage ────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o server ./cmd/server/main.go

# ── Runtime stage ───────────────────────────────────────────────────────────
# We need a full Go install at runtime because the server spawns `go run`
# child processes to compile and execute student code.
FROM golang:1.23-alpine

RUN apk add --no-cache git

WORKDIR /app
COPY --from=builder /app/server .

# Create persistent data directory for JSON stores
RUN mkdir -p /data

# Seed the platform with the starter challenges
COPY data/challenges.json /data/challenges.json

EXPOSE 8080

ENV DATA_DIR=/data
ENV GOPATH=/root/go
ENV PATH=$PATH:/usr/local/go/bin

CMD ["./server"]
