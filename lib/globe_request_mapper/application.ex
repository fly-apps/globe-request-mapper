defmodule GlobeRequestMapper.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  def start(_type, _args) do
    topologies = Application.get_env(:libcluster, :topologies) || []
    children = [
      # Start the Telemetry supervisor
      GlobeRequestMapperWeb.Telemetry,
      # Start the PubSub system
      {Phoenix.PubSub, name: GlobeRequestMapper.PubSub},
      # Track nodes
      GlobeRequestMapper.NodeManager,
      # Handle requests
      GlobeRequestMapper.Request,
      # start libcluster
      {Cluster.Supervisor, [topologies, [name: LiveViewCounter.ClusterSupervisor]]},
      # Start the Endpoint (http/https)
      GlobeRequestMapperWeb.Endpoint
      # Start a worker by calling: GlobeRequestMapper.Worker.start_link(arg)
      # {GlobeRequestMapper.Worker, arg}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: GlobeRequestMapper.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  def config_change(changed, _new, removed) do
    GlobeRequestMapperWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end