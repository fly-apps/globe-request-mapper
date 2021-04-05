defmodule GlobeRequestMapper.Request do
  use GenServer

  alias Phoenix.PubSub
  alias GlobeRequestMapper.NodeManager

  @name :request_server

  def topic do
    "requests"
  end

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: @name)
  end

  def init(coordinates) do
    {:ok, coordinates}
  end

  def get_ip_coords(ip) do
    GenServer.call @name, {:get_coordinates, ip}
  end

  def add_request(ip) do
    request = %{from: get_ip_coords(ip), to: NodeManager.get_node_coords().coords}
    PubSub.broadcast(GlobeRequestMapper.PubSub, topic(), {:request, request})
  end

  def add_request(ip, to_coords) do
    request = %{from: get_ip_coords(ip), to: to_coords}
    PubSub.broadcast(GlobeRequestMapper.PubSub, topic(), {:request, request})
  end

  def handle_call({:get_coordinates, ip}, _from, coordinates) do
    case Map.get(coordinates, ip) do
      nil -> fetch_ip_coords(ip, coordinates)
      coords -> {:reply, coords, coordinates}
    end
  end

  defp fetch_ip_coords(ip, coordinates) do
    HTTPoison.start

    case HTTPoison.get("http://ip-api.com/json/#{ip}") do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        coords = body
                 |> Jason.decode!
                 |> Map.take(["lat", "lon"])
                 |> Map.new(fn {k, v} ->
          case k do
            "lat" -> {:lat, v}
            "lon" -> {:long, v}
          end
        end)
        {:reply, coords, Map.put(coordinates, ip, coords)}

      # In production you probably want something better
      {:error, _} -> {:reply, %{lat: nil, long: nil}, coordinates}
    end
  end
end