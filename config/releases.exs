import Config

secret_key_base =
  System.get_env("SECRET_KEY_BASE") ||
    raise """
    environment variable SECRET_KEY_BASE is missing.
    You can generate one by calling: mix phx.gen.secret
    """

fly_api_key =
  System.get_env("FLY_API_KEY") ||
    raise """
    environment variable FLY_API_KEY is missing.
    """

app_name =
  System.get_env("FLY_APP_NAME") ||
    raise "FLY_APP_NAME not available"

config :globe_request_mapper, GlobeRequestMapperWeb.Endpoint,
       server: true,
       http: [
         port: String.to_integer(System.get_env("PORT") || "4000"),
         transport_options: [socket_opts: [:inet6]]
       ],
       check_origin: false,
       secret_key_base: secret_key_base


config :libcluster,
       debug: true,
       topologies: [
         fly6pn: [
           strategy: Elixir.Cluster.Strategy.DNSPoll,
           config: [
             polling_interval: 5_000,
             query: "#{app_name}.internal",
             node_basename: app_name]]]

# Do not include metadata nor timestamps in development logs
config :logger, :console, format: "[$level] $message\n"