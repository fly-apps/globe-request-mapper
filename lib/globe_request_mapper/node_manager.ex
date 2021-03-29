defmodule GlobeRequestMapper.NodeManager do
  use GenServer

  alias Phoenix.PubSub

  @name :nodes_server

  def fly_region do
    System.get_env("FLY_REGION", "unknown")
  end

  def fly_api_key do
    System.get_env("FLY_API_KEY")
  end

  def topic do
    "nodes"
  end

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, fetch_region_coords(), name: @name)
  end

  def init(state) do
    PubSub.broadcast(GlobeRequestMapper.PubSub, topic(), :update_nodes)
    :ok = :net_kernel.monitor_nodes(true)
    {:ok, state}
  end

  def get_node_coords do
    GenServer.call @name, :node_coords
  end

  def get_data_centers do
    [get_node_coords()] ++ (:rpc.multicall(Node.list(), GlobeRequestMapper.NodeManager, :get_node_coords, []) |> elem(0))
  end

  def handle_call(:node_coords, _from, state) do
    {:reply, state, state}
  end

  def handle_info({event, _node}, state) when event in [:nodeup, :nodedown] do
    case event do
      :nodedown -> PubSub.local_broadcast(GlobeRequestMapper.PubSub, topic(), :update_nodes)
      _ -> :ok
    end

    {:noreply, state}
  end

  defp fetch_region_coords do
    Neuron.Config.set(url: "https://api.fly.io/graphql")
    Neuron.Config.set(headers: ["Authorization": "Bearer #{fly_api_key()}"])

    res = Neuron.query(
      """
      {
        platform {
          regions {
            code
            latitude
            longitude
          }
        }
      }
      """
    )

    regions = case res do
      {
        :ok,
        %Neuron.Response{
          body: %{
            "data" => %{
              "platform" => %{
                "regions" => regions
              },
            },
          },
          status_code: 200
        }
      } -> regions
    end

    region = Enum.find regions, fn region ->
      region["code"] === String.downcase(fly_region())
    end

    Map.new(code: region["code"], coords: %{lat: region["latitude"], long: region["longitude"]})
  end
end