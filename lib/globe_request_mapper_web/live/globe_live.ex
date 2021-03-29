defmodule GlobeRequestMapperWeb.GlobeLive do
  use Phoenix.LiveView

  alias Phoenix.PubSub
  alias GlobeRequestMapper.NodeManager
  alias GlobeRequestMapper.Request

  @node_topic NodeManager.topic
  @requests_topic Request.topic

  def mount(_params, session, socket) do
    PubSub.subscribe(GlobeRequestMapper.PubSub, @node_topic)
    PubSub.subscribe(GlobeRequestMapper.PubSub, @requests_topic)

    Request.add_request(session["remote_ip"])
    send(self(), {:my_coords, Request.get_ip_coords(session["remote_ip"])})

    :timer.send_interval(1000, :clear_requests)

    data_centers = NodeManager.get_data_centers()

    {:ok,
      socket
        |> assign(:requests, [])
        |> assign(:remote_ip, session["remote_ip"])
        |> assign(:data_centers, data_centers)
        |> push_event("data_centers", %{data_centers: data_centers})
    }
  end

  def handle_info({:my_coords, coords}, socket) do
    {:noreply,
      socket
      |> push_event("my_coords", %{coords: coords})
    }
  end

  def handle_info(:update_nodes, socket) do
    data_centers = NodeManager.get_data_centers()

    {:noreply,
      socket
        |> assign(:data_centers, data_centers)
        |> push_event("data_centers", %{data_centers: data_centers})
    }
  end

  def handle_info({:request, request}, %{ assigns: %{ requests: requests } } = socket) do
    case length(requests) do
      len when len < 10 ->
        {:noreply,
          socket
          |> assign(:requests, [request] ++ requests)
          |> push_event("request", %{request: request})
        }
      _ ->
        {:noreply, socket}
    end
  end

  def handle_info(:clear_requests, socket) do
    {:noreply, assign(socket, :requests, [])}
  end

  def handle_event("request", value, %{ assigns: %{ data_centers: data_centers, remote_ip: remote_ip } } = socket) do
    if Map.has_key?(value, "node") do
      case Enum.find(data_centers, fn dc -> dc.code == value["node"] end) do
        %{ code: _, coords: coords } -> Request.add_request(remote_ip, coords)
        _ -> :ok
      end
    else
      Request.add_request(remote_ip)
    end

    {:noreply, socket}
  end
end