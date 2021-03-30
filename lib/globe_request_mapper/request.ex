defmodule GlobeRequestMapper.Request do
  alias Phoenix.PubSub
  alias GlobeRequestMapper.NodeManager

  def topic do
    "requests"
  end

  def add_request(ip) do
    request = %{from: get_ip_coords(ip), to: NodeManager.get_node_coords().coords}
    PubSub.broadcast(GlobeRequestMapper.PubSub, topic(), {:request, request})
  end

  def add_request(ip, to_coords) do
    request = %{from: get_ip_coords(ip), to: to_coords}
    PubSub.broadcast(GlobeRequestMapper.PubSub, topic(), {:request, request})
  end

  def get_ip_coords(ip) do
    case Redix.pipeline(:redix_conn, [["GET", "#{ip}-lat"], ["GET", "#{ip}-long"]]) do
       {:ok, [nil, nil]} -> fetch_ip_coords(ip)
       {:ok, coords} ->
         coords
           |> Enum.with_index()
           |> Map.new(fn {v, idx} ->
                 case idx do
                   0 -> {:lat, String.to_float(v)}
                   1 -> {:long, String.to_float(v)}
                 end
              end)
      {:error, %Redix.ConnectionError{reason: reason}} when reason in [:disconnected, :closed]
        -> fetch_ip_coords(ip)
    end
  end

  defp fetch_ip_coords(ip) do
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

        # GEOADD disabled on Fly
        Redix.pipeline(:redix_conn, [
          ["SET", "#{ip}-lat", Float.to_string(coords.lat)], ["SET", "#{ip}-long", Float.to_string(coords.long)]
        ])

        coords
      # In production you probably want something better
      {:error, _} -> %{lat: nil, long: nil}
    end
  end
end