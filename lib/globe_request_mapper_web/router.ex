defmodule GlobeRequestMapperWeb.Router do
  use GlobeRequestMapperWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, {GlobeRequestMapperWeb.LayoutView, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
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

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", GlobeRequestMapperWeb do
    pipe_through :browser

    live "/", GlobeLive, :index
  end

  # Other scopes may use custom stacks.
  # scope "/api", GlobeRequestMapperWeb do
  #   pipe_through :api
  # end

  # Enables LiveDashboard only for development
  #
  # If you want to use the LiveDashboard in production, you should put
  # it behind authentication and allow only admins to access it.
  # If your application does not have an admins-only section yet,
  # you can use Plug.BasicAuth to set up some basic authentication
  # as long as you are also using SSL (which you should anyway).
  if Mix.env() in [:dev, :test] do
    import Phoenix.LiveDashboard.Router

    scope "/" do
      pipe_through :browser
      live_dashboard "/dashboard", metrics: GlobeRequestMapperWeb.Telemetry
    end
  end
end