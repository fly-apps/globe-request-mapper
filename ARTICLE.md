# Three.js + Elixir: Map requests onto a globe in real time

As your application grows you're going to encounter problems such as how to handle scaling, fault tolerance, global distribution, and how you are going to ensure highly availablity to your users. These aren't new problems and thankfully there's been a lot of thought put into solving them. My absolute favorite language for tackling scalability issues is Elixir. There's a lot to love about Elixir, one of them being it turns scaling your app into an enjoyment instead of a massive headache. I'll show you what I mean with this neat project I've been working on.

I've been noticing a trend that companies are adding fancy, interactive globes to their websites. You can see examples of this on [Stripe](https://stripe.com/enterprise) and [GitHub](https://github.com/)'s homepages. After seeing how cool they are, I decided to build my own and then show others what I learned. The result is a globe that can map requests going to a cluster of nodes in real time. Since I used [Phoenix](https://phoenixframework.org/), a framework for Elixir, I was able to accomplish this in only a few hundred lines of code.

<img src="./images/dashboard.png?raw=true" width="75%">

> The globe project

The overview is that the globe plots the Phoenix nodes on the globe as blue boxes, then whenever a node recieves a request it broadcasts it to the other nodes. They all then emit an event to the clients that tells the globes being viewed to update. The event contains the node's coordinates and the approximate coordinates of the requester's IP which are then drawn on the globes.

### How Elixir helps

Elixir is based off of Erlang meaning we can use all of the functionality that [Erlang provides](https://erlang.org/doc/). The syntax of Elixir feels very modern and is easier to understand than Erlang. Though there's a lot more than just the syntax to love about Elixir as I'll show later on. Moving on to what we need for the globe, there's really only two things we need to detect.

1. When a node join or leaves
2. When someone views the globe

Through the use of OTP applications this is extremely easy to do. To be notified when a node joins or leaves, the function [:net_kernel.monitor_nodes](https://erlang.org/doc/man/net_kernel.html#monitor_nodes-1) exists. When someone views the globe is even easier to detect, it's just whenever someone visits the route the globe is on in your Phoenix application. Whenever either of these things happen, just broadcast the change to all the clients with Phoenix's built in pub/sub. *That's it.* 

### What about scaling?

After you write your shinny new Elixir app you'll start thinking about distribution and scaling. This is where [libcluster](https://github.com/bitwalker/libcluster) comes into play. Libcluster is a library that provides as the description describes "automatic cluster formation/healing for Elixir applications." It gives several clustering strategies such as Kubernetes and DNS polling out of the box, or you can write your own.

Depending on your hosting provider you might be able to have them handle adding and removing nodes. After deploying the globe app to Fly, I'm able to take advantage of the autoscaling feature that Fly offers. This means that when there's a lot of traffic people will see nodes joining the cluster and popping up on the globe, then when the traffic decreases nodes are taken away.

The app uses DNS to find nodes that have joined the private network.

```yaml
fly6pn: [
  strategy: Elixir.Cluster.Strategy.DNSPoll,
    config: [
      polling_interval: 5_000,
      query: "#{app_name}.internal",
      node_basename: app_name]]
```

The DNS clustering strategy on a private network gives a layer of security, only nodes inside the private network can join. With this configuration the `.internal` address is used to do a DNS lookup to find instances of the app running on Fly's encrypted private network.

### How do the nodes communicate?

Whenever a node joins all of the globes need to recieve the coordinates of it in order to plot it. This is common functionality and there are many solutions to it, Elixir School has a [great overview](https://elixirschool.com/en/lessons/advanced/otp-distribution/) of some of them. One of the easiests methods is the built in [RPC functionality](https://erlang.org/doc/man/rpc.html) Erlang has. The RPC function `multicall` is given a list of nodes, then it calls a function on the given nodes.

Whenever a node joins the cluster it broadcasts a join event. All of the nodes then use `multicall` to call a function on all of the nodes they are connected. This function returns the coordinates of node. Now each node can pass the coordinates to all of the clients connected to it.

```elixir
:rpc.multicall(Node.list(), GlobeRequestMapper.NodeManager, :get_node_coords, [])
```

With this one line we are able to build a list of all the coordinates of every node in the cluster.

### Caching

In order to get the coordinates of each request, an IP look up to an API for geo location is required. In order to limit the number of API requests and to make subsequent requests faster, caching is required. Fly provides a Redis cluster in each region your app is deployed in, it can be access through the `FLY_REDIS_CACHE_URL` enviromental variable. This makes caching the latitude and longitude of IP addresses really easy and cuts down on latency big time. Whenever a request comes in just check if it's in the Redis cache or not.

```elixir
case Redix.pipeline(conn, [["GET", "#{ip}-lat"], ["GET", "#{ip}-long"]]) do
  {:ok, [nil, nil]} -> fetch_ip_coords(ip)
  {:ok, coords} -> coords
end
```

### Conclusion

Through the power of Phoenix/Elixir it's possible with only a few hundred lines of code to create a distributed, interactive globe that maps real time data. Elixir is designed to be used for distributed systems, it makes something like this globe project relatively easy to do. There's a lot of features you can add to a project like this, I hope I sparked your imagination. I couldn't go over every aspect of this project, but you can view this project on [GitHub](https://github.com/monroeclinton/globe-request-mapper/) for more technical details and the source code.
