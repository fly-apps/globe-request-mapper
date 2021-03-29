# Three.js + Phoenix: Map requests onto a globe in real time

I've been noticing a trend that companies are adding fancy, interactive globes to their websites. You can see examples of this on [Stripe](https://stripe.com/enterprise) and [GitHub](https://github.com/)'s homepages. After seeing how cool they are, I decided to build my own and then show others what I learned. The result is a globe that can map requests going to a cluster of [Phoenix](https://phoenixframework.org/) nodes in real time.

Phoenix is a framework for Elixir which makes building highly scalable, distribute apps is easy. The other part of this project is [Three.js](https://github.com/mrdoob/three.js/), a JavaScript 3d library, which is used to create the globe. The application runs on [Fly](https://fly.io), meaning it can be easily deployed and scaled to a variety of locations.

<img src="./images/dashboard.png?raw=true" width="75%">

> What we will be building

The overview is that we will plot the Phoenix nodes on the globe as blue boxes, then whenever a node recieves a request it broadcasts it to the other nodes. They all then emit an event to the clients that tells the globes being viewed to update. The event contains the node's coordinates and the approximate coordinates of the requester's IP.

## Phoenix

When creating the Phoenix project, you can use `mix phx.new globe_request_mapper --live --no-ecto` to setup a Phoenix [LiveView](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html) project. LiveView has many tools that allow for easy development of interactive webpages, we will explore some of them.

### Globe LiveView

In the file `globe_request_mapper_web/live/globe_live.ex` we create a module:

```elixir
defmodule GlobeRequestMapperWeb.GlobeLive do
  use Phoenix.LiveView

  alias Phoenix.PubSub
  # We will define these later
  alias GlobeRequestMapper.NodeManager
  alias GlobeRequestMapper.Request

  @node_topic NodeManager.topic
  @requests_topic Request.topic

  def mount(_params, session, socket) do
    # Listens for when nodes join and leave
    PubSub.subscribe(GlobeRequestMapper.PubSub, @node_topic)
    # Listens for requests
    PubSub.subscribe(GlobeRequestMapper.PubSub, @requests_topic)

    {:ok, socket}
  end
end
```

The `mount` function is called everytime a socket connects. The LiveView then automatically tries to render `globe_request_mapper_web/live/globe_live.html.leex`, so let's add some templating there.

```leex
<div class="container">
    <div class="globe-wrapper">
        <!-- phx-update tells Phoenix not to update this bit when it recieves an event -->
        <div id="globe-hook" phx-hook="Globe" phx-update="ignore">
            <!-- Where we mount the Three.js globe -->
            <div id="globe" phx-update="ignore"></div>
        </div>
        <p>* Blue box represents node</p>
        <p>* Red box represents your approx position</p>
        <hr />
        <div>
            <button phx-click="request">Send Request</button>
        </div>
    </div>
    <div class="actions-wrapper">
      <!-- Fill in later -->
    </div>
</div>
```

To allow connections we will need to add the module in `globe_request_mapper_web/router.ex`.

```elixir
scope "/", GlobeRequestMapperWeb do
  pipe_through :browser

  live "/", GlobeLive, :index
end
```

Now create `globe_request_mapper/node_manager.ex`. This module will listen for when nodes join and leave the cluster, broadcasting to the socket to update the globes when they do.

```elixir
def fly_region do
  System.get_env("FLY_REGION", "unknown")
end

def fly_api_key do
  System.get_env!("FLY_API_KEY")
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
  
def handle_call(:node_coords, _from, state) do
  {:reply, state, state}
end
```

In the `init` function, `:net_kernel.monitor_nodes` listens for when nodes join and leave. We can listen for `:nodeup` and `:nodedown`.

```elixir
def handle_info({event, _node}, state) when event in [:nodeup, :nodedown] do
  case event do
    :nodedown -> PubSub.local_broadcast(GlobeRequestMapper.PubSub, topic(), :update_nodes)
    _ -> :ok
  end

  {:noreply, state}
end
```

We don't do anything for `:nodeup` because the event occurs right when the node joins the cluster. This means the genserver may not be started yet, so we cannot call its `get_node_coords` function. Instead once the genserver is started we broadcast to the cluster `:update_nodes` as seen in the `init` function.

Using `:rpc.multicall`, retrieve all the coordinates of the nodes in the cluster:
```elixir
def get_data_centers do
  [get_node_coords()] ++ (:rpc.multicall(Node.list(), GlobeRequestMapper.NodeManager, :get_node_coords, []) |> elem(0))
end
```

Retrieve the node's coordinates using Fly's GraphQL API:
```elixir
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
```

We can now listen for node events in `globe_live.ex`.
```elixir
def mount(_params, session, socket) do
  ...
  data_centers = NodeManager.get_data_centers()

  {:ok,
    socket
      # Request info for later on
      |> assign(:requests, [])
      |> assign(:remote_ip, session["remote_ip"])
      # Node info
      |> assign(:data_centers, data_centers)
      |> push_event("data_centers", %{data_centers: data_centers})
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
```

The only thing left server side is to handle requests. Create the file `globe_request_mapper/request.ex`. We cache the coordinate results in Redis, with Fly it is automatically included in each node. You can access Redis through `FLY_REDIS_CACHE_URL`.
```elixir
def topic do
  "requests"
end

# Requesting connected node
def add_request(ip) do
  request = %{from: get_ip_coords(ip), to: NodeManager.get_node_coords().coords}
  PubSub.broadcast(GlobeRequestMapper.PubSub, topic(), {:request, request})
end

# For when requesting a specific node
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
```

Before modifying the LiveView file, it is necessary to change `router.ex` to make the client IP accessible. Fly passes the client IP in the header `Fly-Client-IP`.
```elixir
pipeline :browser do
  ...
  
  plug :get_remote_ip
end

def get_remote_ip(conn, _) do
  flyClientIps = Plug.Conn.get_req_header(conn, "fly-client-ip")
  xForwardForIps = Plug.Conn.get_req_header(conn, "x-forwarded-for")

  cond do
    flyClientIps != [] -> Plug.Conn.put_session(conn, :remote_ip, hd(flyClientIps))
    xForwardForIps != [] -> Plug.Conn.put_session(conn, :remote_ip, hd(xForwardForIps))
    Application.get_env(:globe_request_mapper, :env) == :dev
      -> Plug.Conn.put_session(conn, :remote_ip, System.get_env("DEV_IP"))
  end
end
```

Back in `globe_live.ex` we add our events:

```elixir
def mount(_params, session, socket) do
  Request.add_request(session["remote_ip"])
  send(self(), {:my_coords, Request.get_ip_coords(session["remote_ip"])})

  # We clear stored requests after 1 second, only allowing 10 requests per second
  :timer.send_interval(1000, :clear_requests)
end

def handle_info({:my_coords, coords}, socket) do
  {:noreply,
    socket
    |> push_event("my_coords", %{coords: coords})
  }
end

def handle_info({:request, request}, %{ assigns: %{ requests: requests } } = socket) do
  # Allow 10 requests per second to be broadcast
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

# The "request" buttons in the template file
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
```

We made the `data_centers` variable available to the template by assigning it in the mount function. Let's use it in the template file to allow for users to make requests to other nodes:
```leex
<%= for dcn <- @data_centers do %>
  <tr>
    <th class="region">
      <img src="https://fly.io/ui/images/<%= dcn.code %>.svg" />
      <%= dcn.code %>
    </th>
    <td>
      <!-- phx-click defines event name, phx-value assigns value -->
      <button class="request-button" phx-click="request" phx-value-node="<%= dcn.code %>">
        Request
      </button>
    </td>
  </tr>
<% end %>
```

### Globe JavaScript

Phoenix creates the file `assets/js/app.js`, we need to add a hook here that listens for events and also renders the globe.
```js
import DataCenterGlobe from "./src/DataCenterGlobe";

const globeContainer = document.getElementById("globe");
const globe = new DataCenterGlobe(globeContainer, 500, 500);

let Hooks = {}
Hooks.Globe = {
    mounted() {
        this.handleEvent("my_coords", this.myCoords)
        this.handleEvent("data_centers", this.dataCenters)
        this.handleEvent("request", this.request)
    },
    myCoords: ({coords}) => {
        globe.plotMyCoordinates(coords);
        globe.focusCamera(coords);
        globe.render();
    },
    dataCenters: ({data_centers: dataCenters}) => {
        globe.setDataCenters(dataCenters);
    },
    request: ({request}) => {
        globe.addCurve(request.from, request.to)
    },
}

let liveSocket = new LiveSocket("/live", Socket, {
    hooks: Hooks,
    params: {_csrf_token: csrfToken}
});
```

You can look through the [DataCenterGlobe.ts](https://github.com/monroeclinton/globe-request-mapper/blob/main/assets/js/src/DataCenterGlobe.ts) to see the functionality Three.js provides for creating a globe and mapping requests/noes on it.

In the `DataCenterGlobe` file, a node box geometry is used and mapped onto the globe:
```js
dataCenters.forEach(location => {
  const dataCenter = new Mesh(boxGeometry, boxMaterial);
  dataCenter.position.copy(Geometry.toCartesian(location.coords, 100));

  this.scene.add(dataCenter);
  this.dataCenters.push(dataCenter)
});
```

Then tube gemotry is used to create a request:
```js
const ctrl1 = Geometry.toCartesian(Geometry.getSphericalWayPoint(startCoord, endCoord, 0.25), 100 + altitude);
const ctrl2 = Geometry.toCartesian(Geometry.getSphericalWayPoint(startCoord, endCoord, 0.75), 100 + altitude);

const curve = new CubicBezierCurve3(
  startCartesian,
  ctrl1,
  ctrl2,
  endCartesian,
);

const tubeGeometry = new TubeBufferGeometry(curve, 5, 0.25, 8, false);

const tubeMaterial = new MeshBasicMaterial({
  color: 0x707070,
});

const curveObject = new Line(tubeGeometry, tubeMaterial);
this.scene.add(curveObject);
```

### libcluster
The way the nodes find each other and join the cluster is through a dependency called [libcluster](https://github.com/bitwalker/libcluster). This allows nodes to join a cluster and find each other through multiple clustering strategies. In `config/dev.exs` we can specify one of our own:
```elixir
config :libcluster,
       debug: true,
       topologies: [
         localnet: [
           strategy: Elixir.Cluster.Strategy.Epmd,
           config: [
             polling_interval: 5_000,
             hosts: [:"a@127.0.0.1", :"b@127.0.0.1", :"c@127.0.0.1"]]]]
```

Now you can started a node with the following:
```
PORT=4000 FLY_REGION=hkg FLY_REDIS_CACHE_URL=redis://localhost:6379 FLY_API_KEY=PRIVATE_KEY iex --name a@127.0.0.1 -S mix phx.server
```

### Conclusion

We've seen how with only a few hundred lines of code it's possible to create a distributed, interactive globe that maps real time data. Phoenix/Elixir combined with Fly is designed to be used for distributed systems, it makes something like this globe project relatively easy to do. There's a lot of features you can add to a project like this, I hope I sparked your imagination. I couldn't go over every aspect of this project because it would be too long, but you can view this project on [GitHub](https://github.com/monroeclinton/globe-request-mapper/) for more technical details and the source code.
