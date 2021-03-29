# GlobeRequestMapper

This is a globe that shows traffic going from the origin to its nearest data center using [Three.js](https://github.com/mrdoob/three.js/), [Phoenix](https://phoenixframework.org/), and [Fly](https://fly.io).

![Globe](./images/globe.png?raw=true)

# Usage

View [ARCHITECTURE.md](./ARCHITECTURE.md) to see the structure of this project.

# Install / Getting started
You will need the following for this project:
- Elixir
- Redis
- A Fly account

## Development
To start the Phoenix server:

- Install dependencies with `mix deps.get`
- Install Node.js dependencies with `npm install` inside the `assets` directory
- Modify `libcluster` in `config/dev.exs` to meet your needs.
- Start a node with the following command (fill in your details)
```
PORT=4000 FLY_REGION=hkg FLY_REDIS_CACHE_URL=redis://localhost:6379 FLY_API_KEY=PRIVATE_KEY iex --name a@127.0.0.1 -S mix phx.server
```

Now you can visit [`localhost:4000`](http://localhost:4000) from your browser.

## Production
To run in production:

- Create a release `MIX_ENV=prod mix deps.get`
- Make a Fly app and use `flyctl deploy`